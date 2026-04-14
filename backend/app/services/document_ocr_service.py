"""
Kavya Transports — Document OCR Service (Phase 1)
Image pre-processing + Tesseract OCR + regex field extraction
for Indian transport documents (RC, Insurance, DL, Fitness, PUC).

Tech stack (all free / open-source):
  - OpenCV  : grayscale, deskew, denoise, threshold
  - Pillow  : I/O, resize
  - pytesseract : OCR via system Tesseract binary
  - pdf2image   : PDF first-page → image conversion
  - numpy   : image matrix operations

Language packs required (install once):
  macOS : brew install tesseract tesseract-lang
  Linux : apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-tam
"""

from __future__ import annotations

import io
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# Lazy imports so the app starts even when libs are absent
# ──────────────────────────────────────────────────────────
try:
    import cv2
    import numpy as np
    _CV2_AVAILABLE = True
except ImportError:
    cv2 = None  # type: ignore
    np = None  # type: ignore
    _CV2_AVAILABLE = False
    logger.warning("opencv-python not installed — image preprocessing disabled")

try:
    import pytesseract
    from PIL import Image, ImageEnhance
    _TESS_AVAILABLE = True
except ImportError:
    pytesseract = None  # type: ignore
    Image = None  # type: ignore
    _TESS_AVAILABLE = False
    logger.warning("pytesseract / Pillow not installed — OCR disabled")

try:
    from pdf2image import convert_from_bytes
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False
    logger.warning("pdf2image not installed — PDF upload fallback disabled")


# ──────────────────────────────────────────────────────────
# Data Classes
# ──────────────────────────────────────────────────────────

@dataclass
class ExtractedField:
    value: str
    confidence: str            # 'high' | 'medium' | 'low'
    raw_match: str


@dataclass
class OCRResult:
    raw_text: str
    lines: List[str]
    extracted_fields: Dict[str, ExtractedField]
    overall_confidence: float  # 0.0 – 1.0
    doc_type_detected: str
    error: Optional[str] = None
    word_data: List[Dict[str, Any]] = field(default_factory=list)


# ──────────────────────────────────────────────────────────
# Supported document types & their extractable fields
# ──────────────────────────────────────────────────────────

SUPPORTED_DOC_TYPES: Dict[str, List[str]] = {
    "RC": [
        "registration_number", "owner_name", "chassis_number",
        "engine_number", "valid_upto", "vehicle_class", "fuel_type",
        "make", "model_name", "year_of_manufacture",
    ],
    "Insurance": [
        "policy_number", "insurer_name", "vehicle_number",
        "valid_from", "valid_upto", "premium_amount", "coverage_type",
    ],
    "DrivingLicense": [
        "dl_number", "holder_name", "dob", "valid_upto",
        "vehicle_class", "blood_group", "mobile_number",
    ],
    "Fitness": [
        "certificate_number", "transaction_no", "receipt_no", "receipt_date",
        "vehicle_number", "vehicle_no", "vehicle_class", "owner_name",
        "chassis_no", "fitness_validity", "tax_paid_upto", "valid_upto", "issued_by",
    ],
    "PUC": [
        "puc_number", "vehicle_number", "test_date", "valid_upto",
        "emission_values",
    ],
    "Other": ["raw_lines"],
}

# Known Indian insurance company names for matching
_INDIAN_INSURERS = [
    "new india", "united india", "oriental", "national insurance",
    "bajaj allianz", "icici lombard", "hdfc ergo", "tata aig",
    "reliance general", "royal sundaram", "cholamandalam",
    "future generali", "liberty general", "iffco tokio",
    "shriram general", "digit insurance", "acko",
]


# ──────────────────────────────────────────────────────────
# Helpers — Indian vehicle reg number regex
# ──────────────────────────────────────────────────────────

_VEH_REG = re.compile(
    r'\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{1,4})\b',
    re.IGNORECASE,
)

_DATE_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r'(\d{2})[/\-\.](\d{2})[/\-\.](\d{4})'), "dmy"),      # DD/MM/YYYY
    (re.compile(r'(\d{4})[/\-\.](\d{2})[/\-\.](\d{2})'), "ymd"),      # YYYY-MM-DD
    (re.compile(
        r'(\d{1,2})[\s\-/]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s\-/]*(\d{4})',
        re.IGNORECASE
    ), "dmsy"),  # DD Mon YYYY
]

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def _normalise_date(text: str) -> Optional[str]:
    """Return first parseable date in text as YYYY-MM-DD or None."""
    for pat, fmt in _DATE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        try:
            if fmt == "dmy":
                return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
            elif fmt == "ymd":
                return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            elif fmt == "dmsy":
                month = _MONTH_MAP.get(m.group(2)[:3].lower(), "01")
                day = m.group(1).zfill(2)
                return f"{m.group(3)}-{month}-{day}"
        except Exception:
            continue
    return None


def _normalise_title_case_date(text: str) -> Optional[str]:
    """Return date as DD-Mon-YYYY (e.g., 26-Feb-2027) when parseable."""
    value = (text or "").strip()
    if not value:
        return None

    value = re.sub(r"\s+", " ", value)
    value = value.replace(".", "-")
    value = value.replace("–", "-").replace("—", "-")
    value = re.sub(r"\s*[-/]\s*", "-", value)
    value = re.sub(r"[^0-9A-Za-z\-/ ]", "", value).strip()

    formats = [
        "%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y", "%d/%m/%Y",
        "%Y-%m-%d", "%Y/%m/%d", "%d %b %Y", "%d %B %Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%d-%b-%Y")
        except ValueError:
            continue
    return None


def _find_value_after_label(text: str, *labels: str, max_chars: int = 80) -> Optional[str]:
    """Return the first non-empty token/line after any of the given label strings.

    Handles two layouts:
      • Inline:    "Name: ARVIND KUMAR"
      • Next-line: "Name:\nARVIND KUMAR"   (common on Indian smart-card DLs)
    """
    for label in labels:
        escaped = re.escape(label)
        # 1. Same-line: label followed by value on the same line
        same_line = re.compile(
            rf'(?:{escaped})\s*[:\-\.]?\s*([^\n]{{1,{max_chars}}})',
            re.IGNORECASE,
        )
        m = same_line.search(text)
        if m:
            val = m.group(1).strip()
            if val:
                return val
        # 2. Next-line: label is alone on its line; value is on the line immediately below
        next_line = re.compile(
            rf'(?:{escaped})[^\n]*\n\s*([^\n]{{1,{max_chars}}})',
            re.IGNORECASE,
        )
        m = next_line.search(text)
        if m:
            val = m.group(1).strip()
            if val:
                return val
    return None


def _confidence(value: Optional[str], *, high_pattern: Optional[re.Pattern] = None) -> str:
    if not value:
        return "low"
    if high_pattern and high_pattern.match(value):
        return "high"
    if len(value) >= 5:
        return "medium"
    return "low"


def _ef(value: str, conf: str, raw: str = "") -> ExtractedField:
    return ExtractedField(value=value, confidence=conf, raw_match=raw or value)


# ──────────────────────────────────────────────────────────
# Language detection
# ──────────────────────────────────────────────────────────

def detect_language(text: str) -> List[str]:
    """
    Heuristically detect language(s) in OCR text.
    Returns list of Tesseract lang codes (always includes 'eng').
    """
    langs = ["eng"]
    # Devanagari (Hindi) Unicode block U+0900–U+097F
    if any('\u0900' <= ch <= '\u097F' for ch in text):
        if "hin" not in langs:
            langs.append("hin")
    # Tamil Unicode block U+0B80–U+0BFF
    if any('\u0B80' <= ch <= '\u0BFF' for ch in text):
        if "tam" not in langs:
            langs.append("tam")
    return langs


# ──────────────────────────────────────────────────────────
# Image pre-processing
# ──────────────────────────────────────────────────────────

def _bytes_to_np(image_bytes: bytes) -> "np.ndarray":
    """Convert raw image bytes to a numpy array (BGR)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — invalid image bytes")
    return img


def _deskew(gray: "np.ndarray") -> "np.ndarray":
    """Straighten a tilted document image via minAreaRect."""
    coords = np.column_stack(np.where(gray < 127))
    if len(coords) < 100:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.5:
        return gray
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess_image(image_bytes: bytes) -> "np.ndarray":
    """
    Full pre-processing pipeline:
      1. grayscale
      2. deskew
      3. denoise
      4. adaptive threshold
      5. resize to ≥ 1500px on the longest side
    Returns a processed numpy array (grayscale uint8).
    """
    if not _CV2_AVAILABLE:
        raise RuntimeError("opencv-python is not installed")

    img = _bytes_to_np(image_bytes)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2. Deskew
    gray = _deskew(gray)

    # 3. Denoise
    gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # 4. Adaptive threshold — makes text crisp black on white
    gray = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )

    # 5. Resize to minimum 1500px on longest side
    h, w = gray.shape
    longest = max(h, w)
    if longest < 1500:
        scale = 1500 / longest
        new_w = int(w * scale)
        new_h = int(h * scale)
        gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    return gray


def _np_to_pil(img_np: "np.ndarray") -> "Image.Image":
    """Convert grayscale numpy array to PIL Image."""
    return Image.fromarray(img_np)


def _load_image_bytes(data: bytes, mime_type: str = "") -> bytes:
    """
    Convert any uploaded file to JPEG bytes for OCR.
    Handles: JPEG, PNG, WEBP, HEIC, PDF (first page).
    """
    mime = mime_type.lower()
    if "pdf" in mime:
        if not _PDF_AVAILABLE:
            raise RuntimeError("pdf2image not installed — cannot process PDF")
        images = convert_from_bytes(data, first_page=1, last_page=1, dpi=200)
        if not images:
            raise ValueError("PDF has no pages")
        buf = io.BytesIO()
        images[0].save(buf, format="JPEG", quality=95)
        return buf.getvalue()
    return data


# ──────────────────────────────────────────────────────────
# Document type auto-detection
# ──────────────────────────────────────────────────────────

_DOC_KEYWORDS: Dict[str, List[str]] = {
    "RC": [
        "registration certificate", "registration card", "reg. no",
        "chassis no", "engine no", "rc book",
        # Hindi keywords
        "पंजीकरण", "वाहन",
        # Tamil keywords
        "பதிவு",
    ],
    "Insurance": [
        "insurance", "policy", "insurer", "premium",
        "vehicle insurance", "motor insurance", "insured",
        "बीमा", "காப்பீடு",
    ],
    "DrivingLicense": [
        "driving licence", "driving license", "dl no", "d.l.no",
        "licence to drive", "ड्राइविंग", "ஓட்டுனர்",
    ],
    "Fitness": ["fitness certificate", "certificate of fitness", "fit upto"],
    "PUC": [
        "pollution", "puc", "pucc", "emission", "pollution under control",
        "प्रदूषण",
    ],
}


def detect_doc_type(text: str) -> str:
    """Detect document type from OCR text using keyword scoring."""
    text_lower = text.lower()
    scores: Dict[str, int] = {k: 0 for k in _DOC_KEYWORDS}
    for doc_type, keywords in _DOC_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                scores[doc_type] += 1
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "Other"


# ──────────────────────────────────────────────────────────
# Per-document-type field extraction
# ──────────────────────────────────────────────────────────

def _extract_rc_fields(text: str) -> Dict[str, ExtractedField]:
    fields: Dict[str, ExtractedField] = {}

    # Registration number
    m = _VEH_REG.search(text)
    if m:
        val = re.sub(r'[\s\-]', '', m.group(1)).upper()
        fields["registration_number"] = _ef(val, "high", m.group(1))

    # Owner name — English and Hindi
    owner = (
        _find_value_after_label(text, "Name of Owner", "Registered Owner", "Owner Name", "Name")
        or _find_value_after_label(text, "वाहन स्वामी", "उपयोगकर्ता का नाम")
    )
    if owner:
        owner = owner.split("\n")[0].strip()[:80]
        fields["owner_name"] = _ef(owner, _confidence(owner), owner)

    # Chassis number — 17-25 char alphanumeric (TN smart card chassis can be 21 chars)
    chassis_pat = re.compile(
        r'(?:chassis\s*(?:no|number)?|chassisno|चेसिस\s*संख्या)\s*[:\-.]?\s*([A-Z0-9X]{6,25})',
        re.IGNORECASE,
    )
    cm = chassis_pat.search(text)
    if cm:
        val = cm.group(1).strip()
        fields["chassis_number"] = _ef(val, "high" if len(val) >= 10 else "medium", val)

    # Engine number — also handles "Engine/Motor Number" label on new smart cards
    engine_pat = re.compile(
        r'(?:engine(?:\/motor)?\s*(?:no|number)?|engineno|इंजन\s*संख्या)\s*[:\-.]?\s*([A-Z0-9X]{6,20})',
        re.IGNORECASE,
    )
    em = engine_pat.search(text)
    if em:
        val = em.group(1).strip()
        fields["engine_number"] = _ef(val, "high" if len(val) >= 6 else "medium", val)

    # Valid upto — also handles "Regn. Validity" / "Regn Validity" on new TN smart cards
    date_ctx = _find_value_after_label(
        text,
        "regn. validity", "regn validity", "valid upto", "reg. upto",
        "registration valid", "validity", "valid till",
        "वैधता", "செல்லுபடியாகும் வரை",
    )
    if date_ctx:
        d = _normalise_date(date_ctx) or _normalise_date(text)
        if d:
            fields["valid_upto"] = _ef(d, "high", date_ctx)

    # Vehicle class
    vc = _find_value_after_label(text, "vehicle class", "class of vehicle", "type of vehicle")
    if vc:
        fields["vehicle_class"] = _ef(vc.split("\n")[0][:30], "medium", vc)

    # Fuel type — handles same-line AND next-line formats (new TN smart card layout)
    fuel_pat = re.compile(
        r'fuel\s*(?:used|type)?\s*[:\-.]?\s*\n?\s*(diesel|petrol|cng|electric|lpg)',
        re.IGNORECASE,
    )
    fm = fuel_pat.search(text)
    if fm:
        fields["fuel_type"] = _ef(fm.group(1).capitalize(), "high", fm.group(0))

    return fields


def _extract_insurance_fields(text: str) -> Dict[str, ExtractedField]:
    fields: Dict[str, ExtractedField] = {}

    # Policy number
    pol_pat = re.compile(
        r'(?:policy\s*(?:no|number)?)[:\s.]+([A-Z0-9\-\/]{8,30})',
        re.IGNORECASE,
    )
    pm = pol_pat.search(text)
    if pm:
        fields["policy_number"] = _ef(pm.group(1).strip(), "high", pm.group(0))

    # Insurer name — check against known list
    text_lower = text.lower()
    for insurer in _INDIAN_INSURERS:
        if insurer in text_lower:
            # Find original casing
            idx = text_lower.index(insurer)
            original = text[idx: idx + len(insurer)]
            fields["insurer_name"] = _ef(original.title(), "high", insurer)
            break

    # Vehicle number
    vm = _VEH_REG.search(text)
    if vm:
        fields["vehicle_number"] = _ef(
            re.sub(r'[\s\-]', '', vm.group(1)).upper(), "high", vm.group(1)
        )

    # Dates — valid from / valid to
    lines = text.split("\n")
    date_vals: List[str] = []
    for line in lines:
        d = _normalise_date(line)
        if d:
            date_vals.append(d)
    if date_vals:
        fields["valid_from"] = _ef(date_vals[0], "medium", date_vals[0])
    if len(date_vals) >= 2:
        fields["valid_upto"] = _ef(date_vals[-1], "medium", date_vals[-1])

    # Premium
    prem_pat = re.compile(r'premium[\s:\-]*(?:rs\.?|₹)?\s*([\d,]+\.?\d*)', re.IGNORECASE)
    prem_m = prem_pat.search(text)
    if prem_m:
        fields["premium_amount"] = _ef(prem_m.group(1).replace(",", ""), "medium", prem_m.group(0))

    return fields


def _extract_dl_fields(text: str) -> Dict[str, ExtractedField]:
    fields: Dict[str, ExtractedField] = {}

    # DL number — Indian format: TN-0520110012345, TN72 2024005499, etc.
    # Serial after year can be 4–9 digits (older cards had 7, new smart cards have 6)
    dl_pat = re.compile(
        r'\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?(?:19|20)\d{2}[\s]?\d{4,9})\b',
        re.IGNORECASE,
    )
    dlm = dl_pat.search(text)
    if dlm:
        fields["dl_number"] = _ef(
            re.sub(r'\s', '', dlm.group(1)).upper(), "high", dlm.group(1)
        )

    # Holder name — on Indian DLs, the name is usually on the line BELOW "Name:"
    # Check next-line first (table-layout), then same-line (inline-layout).
    _name_labels = ["holder name", "dl holder", "name"]
    _name_reject = {"endorsement", "entitlement", "engine", "chassis",
                    "transport", "department", "authority", "driving"}
    _dl_lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    _name_label_re = re.compile(r"(?:holder'?s?\s*name|name\s*of\s*holder|dl\s*holder|\bname\b)(?!.*(?:s/o|d/o|w/o))", re.IGNORECASE)

    # Strategy A: next-line (preferred for Indian smart-card DLs)
    # On Indian DLs, the actual name is almost always on the NEXT line below "Name".
    # Try next-line first, then fall back to inline.
    _so_pat = re.compile(r"^\s*(?:s/?o|d/?o|w/?o|son|daughter|wife|husband)\b", re.IGNORECASE)
    for _li, _ln in enumerate(_dl_lines):
        if _name_label_re.search(_ln):
            # First: try the line(s) below the label
            for _lj in range(_li + 1, min(_li + 4, len(_dl_lines))):
                # Skip S/O, D/O, W/O lines — those are the father's name
                if _so_pat.match(_dl_lines[_lj]):
                    continue
                _cand = re.sub(r"[^A-Za-z\s]", "", _dl_lines[_lj]).strip()
                _words = [w for w in _cand.split() if len(w) >= 2]
                if (len(_cand.replace(" ", "")) >= 4
                        and any(len(w) > 2 for w in _words)
                        and not any(r in _cand.lower() for r in _name_reject)):
                    fields["holder_name"] = _ef(_cand[:80], "medium", _dl_lines[_lj])
                    break
            # Fallback: inline value on the SAME line as label ("Name: BALA KANNAN")
            if "holder_name" not in fields:
                _inline_match = re.search(r"(?:name|holder)\s*[:\-]\s*([A-Za-z][A-Za-z\s.]{3,60})", _ln, re.IGNORECASE)
                if _inline_match:
                    _inline_cand = re.sub(r"[^A-Za-z\s]", "", _inline_match.group(1)).strip()
                    _inline_words = [w for w in _inline_cand.split() if len(w) >= 2]
                    if (len(_inline_cand.replace(" ", "")) >= 4
                            and any(len(w) > 2 for w in _inline_words)
                            and not any(r in _inline_cand.lower() for r in _name_reject)):
                        fields["holder_name"] = _ef(_inline_cand[:80], "medium", _inline_match.group(1).strip())
            break

    # Strategy B: same-line fallback ("Name: BALA KANNAN")
    if "holder_name" not in fields:
        name = _find_value_after_label(text, *_name_labels)
        if name:
            raw_name = name.split("\n")[0].strip()
            alpha_name = re.sub(r"[^A-Za-z\s]", "", raw_name).strip()
            words = [w for w in alpha_name.split() if len(w) >= 2]
            if len(alpha_name.replace(" ", "")) >= 4 and any(len(w) > 2 for w in words):
                if not any(r in alpha_name.lower() for r in _name_reject):
                    fields["holder_name"] = _ef(alpha_name[:80], "medium", raw_name)

    # DOB
    dob_ctx = _find_value_after_label(text, "date of birth", "d.o.b", "dob")
    if dob_ctx:
        d = _normalise_date(dob_ctx)
        if d:
            fields["dob"] = _ef(d, "high", dob_ctx)

    # Valid upto — handles Validity(NT), Validity(TR) as on new TN smart cards
    valid_ctx = _find_value_after_label(
        text,
        "valid to", "validity(nt)", "validity(tr)", "validity", "valid upto", "valid till",
    )
    if valid_ctx:
        d = _normalise_date(valid_ctx)
        if d:
            fields["valid_upto"] = _ef(d, "high", valid_ctx)

    # Vehicle classes
    vc_pat = re.compile(r'\b(LMV|HMV|HGMV|MGV|MCWG|MCWOG|3W|Transport|HTV|PSV)\b', re.IGNORECASE)
    classes = list(dict.fromkeys(m.group(0).upper() for m in vc_pat.finditer(text)))
    if classes:
        fields["vehicle_class"] = _ef(", ".join(classes), "high", str(classes))

    # Blood group — handles A+, A+ve, A+ at end-of-line, with optional label prefix
    bg_pat = re.compile(
        r'(?:blood\s*(?:group)?\s*[:\-]?\s*)?(A|B|AB|O)[+\-](?:ve)?(?=[\s\n,./]|$)',
        re.IGNORECASE | re.MULTILINE,
    )
    bgm = bg_pat.search(text)
    if bgm:
        raw = bgm.group(0).strip()
        # Normalise to A+/A- etc (drop 've' suffix and label prefix)
        group_letter = bgm.group(1).upper()
        sign = '+' if '+' in raw else '-'
        fields["blood_group"] = _ef(f"{group_letter}{sign}", "high", raw)

    return fields


def _extract_fitness_fields(text: str) -> Dict[str, ExtractedField]:
    fields: Dict[str, ExtractedField] = {}

    tn_ref_pat = re.compile(r"\bTN\d{6}[A-Z]\d{7}\b", re.IGNORECASE)

    # Transaction No / Receipt No from "TRANSACTION NO./RECEIPT No.: .../..."
    tx_line = None
    for line in text.split("\n"):
        if re.search(r"TRANSACTION\s*NO", line, re.IGNORECASE) and re.search(r"RECEIPT", line, re.IGNORECASE):
            tx_line = line
            break
    if tx_line:
        refs = tn_ref_pat.findall(tx_line.upper())
        if len(refs) >= 1:
            fields["transaction_no"] = _ef(refs[0], "high", refs[0])
        if len(refs) >= 2:
            fields["receipt_no"] = _ef(refs[1], "high", refs[1])

    # Fallback if OCR split that row
    if "transaction_no" not in fields or "receipt_no" not in fields:
        refs = tn_ref_pat.findall(text.upper())
        if refs and "transaction_no" not in fields:
            fields["transaction_no"] = _ef(refs[0], "medium", refs[0])
        if len(refs) >= 2 and "receipt_no" not in fields:
            fields["receipt_no"] = _ef(refs[1], "medium", refs[1])

    # Receipt date
    receipt_ctx = _find_value_after_label(text, "receipt date")
    if receipt_ctx:
        receipt_date = _normalise_title_case_date(receipt_ctx)
        if receipt_date:
            fields["receipt_date"] = _ef(receipt_date, "high", receipt_ctx)

    # Certificate number
    cert_pat = re.compile(
        r'(?:certificate\s*(?:no|number)|cert\s*(?:no|number)|fitness\s*cert\s*(?:no|number)|fc\s*no)[:\s.\-]*([A-Z0-9\-\/]{5,25})',
        re.IGNORECASE,
    )
    cm = cert_pat.search(text)
    if cm:
        fields["certificate_number"] = _ef(cm.group(1).strip(), "high", cm.group(0))

    # Vehicle number
    veh_ctx = _find_value_after_label(text, "vehicle no", "vehicle number")
    vm = re.search(r"\bTN\d{2}[A-Z]{2}\d{4}\b", (veh_ctx or "").upper())
    if not vm:
        vm = re.search(r"\bTN\d{2}[A-Z]{2}\d{4}\b", text.upper())
    if vm:
        vehicle_no = vm.group(0).upper()
        fields["vehicle_no"] = _ef(vehicle_no, "high", vehicle_no)
        fields["vehicle_number"] = _ef(vehicle_no, "high", vehicle_no)

    # Vehicle class
    vclass = _find_value_after_label(text, "vehicle class")
    if vclass:
        fields["vehicle_class"] = _ef(vclass.split("\n")[0].strip()[:60], "medium", vclass)

    # Owner name
    owner = _find_value_after_label(
        text,
        "owner name",
        "name of owner",
        "registered owner",
        "permit holder name",
        "name of the permit holder",
    )
    if owner:
        clean_owner = owner.split("\n")[0].strip()
        clean_owner = re.split(
            r"\b(?:CHASSIS\s*NO|VEHICLE\s*CLASS|FITNESS\s*VALIDITY|TAX\s*PAID\s*UPTO|RECEIPT\s*DATE)\b",
            clean_owner,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" :.-")
        clean_owner = re.sub(r"\s{2,}", " ", clean_owner)[:80]
        if clean_owner and clean_owner.upper() not in {"NA", "N/A", "NIL", "NULL"}:
            fields["owner_name"] = _ef(clean_owner, _confidence(clean_owner), owner)

    # Chassis no (17-char VIN style)
    ch_ctx = _find_value_after_label(text, "chassis no", "chassis number")
    ch_match = re.search(r"\b[A-Z0-9]{17}\b", (ch_ctx or "").upper())
    if not ch_match:
        ch_match = re.search(r"\b[A-Z0-9]{17}\b", text.upper())
    if ch_match:
        fields["chassis_no"] = _ef(ch_match.group(0), "high", ch_match.group(0))

    # Valid upto: prefer explicit From ... To range when present.
    range_pat = re.compile(
        r'from\s*[:\-=]*\s*([0-9A-Za-z\-/\. ]{6,20})\s+to\s*[:\-=]*\s*([0-9A-Za-z\-/\. ]{6,20})',
        re.IGNORECASE,
    )
    rm = range_pat.search(text)
    if rm:
        d = _normalise_date(rm.group(2))
        if d:
            fields["valid_upto"] = _ef(d, "high", rm.group(2))

    # FC table label: Fitness Validity
    fv_match = re.search(r"FITNESS\s*VALIDITY\s*[:\-]?\s*([0-9A-Za-z\-/ ]{6,20})", text, re.IGNORECASE)
    fitness_validity_ctx = fv_match.group(1) if fv_match else _find_value_after_label(text, "fitness validity")
    if fitness_validity_ctx:
        title_date = _normalise_title_case_date(fitness_validity_ctx)
        if title_date:
            fields["fitness_validity"] = _ef(title_date, "high", fitness_validity_ctx)
            if "valid_upto" not in fields:
                d = _normalise_date(title_date)
                if d:
                    fields["valid_upto"] = _ef(d, "high", title_date)

    if "valid_upto" not in fields:
        date_ctx = _find_value_after_label(text, "valid upto", "fit upto", "valid till", "validity")
        if date_ctx:
            d = _normalise_date(date_ctx)
            if d:
                fields["valid_upto"] = _ef(d, "high", date_ctx)

    # From/To validity fallback
    if "valid_upto" not in fields:
        to_ctx = _find_value_after_label(text, "valid to")
        if to_ctx:
            d = _normalise_date(to_ctx)
            if d:
                fields["valid_upto"] = _ef(d, "medium", to_ctx)

    if "valid_upto" not in fields:
        dates: List[str] = []
        for line in text.split("\n"):
            d = _normalise_date(line)
            if d and d not in dates:
                dates.append(d)
        if len(dates) >= 2:
            fields["valid_upto"] = _ef(dates[-1], "low", dates[-1])
        elif len(dates) == 1:
            fields["valid_upto"] = _ef(dates[0], "low", dates[0])

    # Tax Paid Upto with DD-Mon-YYYY title-case output
    tax_ctx = _find_value_after_label(text, "tax paid upto")
    if not tax_ctx:
        tax_match = re.search(r"TAX\s*PAID\s*UPTO\s*[:\-]?\s*([0-9A-Za-z\-/ ]{6,20})", text, re.IGNORECASE)
        tax_ctx = tax_match.group(1) if tax_match else None
    if tax_ctx:
        tax_date = _normalise_title_case_date(tax_ctx)
        if tax_date:
            fields["tax_paid_upto"] = _ef(tax_date, "high", tax_ctx)

    # Issued by
    by = _find_value_after_label(text, "issued by", "issuing authority", "rto")
    if by:
        fields["issued_by"] = _ef(by.split("\n")[0][:80], "medium", by)

    return fields


def _extract_puc_fields(text: str) -> Dict[str, ExtractedField]:
    fields: Dict[str, ExtractedField] = {}

    # PUC / cert number
    puc_pat = re.compile(
        r'(?:cert(?:ificate)?\s*(?:no|number)?|puc(?:c)?\s*(?:no|number)?)[:\s.]+([A-Z0-9\-\/]{5,25})',
        re.IGNORECASE,
    )
    pm = puc_pat.search(text)
    if pm:
        fields["puc_number"] = _ef(pm.group(1).strip(), "high", pm.group(0))

    # Vehicle number
    vm = _VEH_REG.search(text)
    if vm:
        fields["vehicle_number"] = _ef(
            re.sub(r'[\s\-]', '', vm.group(1)).upper(), "high", vm.group(1)
        )

    # Dates — test date = first, valid upto = second
    dates: List[str] = []
    for line in text.split("\n"):
        d = _normalise_date(line)
        if d and d not in dates:
            dates.append(d)

    if dates:
        fields["test_date"] = _ef(dates[0], "medium", dates[0])
    if len(dates) >= 2:
        fields["valid_upto"] = _ef(dates[1], "medium", dates[1])

    # Emission values (CO, HC)
    em_pat = re.compile(r'(?:co|hc)\s*[:\-]?\s*(\d+\.?\d*\s*%?)', re.IGNORECASE)
    em_vals = [f"{m.group(0).strip()}" for m in em_pat.finditer(text)]
    if em_vals:
        fields["emission_values"] = _ef(", ".join(em_vals), "medium", str(em_vals))

    return fields


def _extract_other_fields(text: str) -> Dict[str, ExtractedField]:
    """For unknown doc types, return first N non-empty lines."""
    lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 3]
    pairs: Dict[str, ExtractedField] = {}
    for i, line in enumerate(lines[:20]):
        pairs[f"line_{i + 1:02d}"] = ExtractedField(value=line, confidence="low", raw_match=line)
    return pairs


# ──────────────────────────────────────────────────────────
# Hindi / Tamil label lookups (supplement English extraction)
# ──────────────────────────────────────────────────────────

_HINDI_LABELS: Dict[str, List[str]] = {
    "registration_number": ["पंजीकरण संख्या", "वाहन संख्या"],
    "owner_name": ["वाहन स्वामी", "मालिक का नाम"],
    "valid_upto": ["वैधता", "मान्य तक"],
    "engine_number": ["इंजन संख्या"],
    "chassis_number": ["चेसिस संख्या"],
}

_TAMIL_LABELS: Dict[str, List[str]] = {
    "registration_number": ["பதிவு எண்"],
    "owner_name": ["உரிமையாளர்"],
    "valid_upto": ["செல்லுபடியாகும் வரை"],
}


def _supplement_with_localised_labels(
    text: str,
    fields: Dict[str, ExtractedField],
    labels: Dict[str, List[str]],
) -> None:
    """Add fields found only in Hindi/Tamil labels if not already extracted."""
    for field_name, label_list in labels.items():
        if field_name in fields:
            continue
        val = _find_value_after_label(text, *label_list)
        if val:
            # Try normalise if it might be a date
            d = _normalise_date(val)
            fields[field_name] = _ef(d or val.split("\n")[0][:80], "medium", val)


# ──────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────

def extract_document_fields(
    text: str,
    doc_type: str,
) -> Dict[str, ExtractedField]:
    """
    Apply regex rules to extract structured fields from raw OCR text.

    Args:
        text:     Raw OCR text from Tesseract.
        doc_type: One of RC | Insurance | DrivingLicense | Fitness | PUC | Other.

    Returns:
        Dict of field_name → ExtractedField(value, confidence, raw_match).
    """
    normalised_text = unicodedata.normalize("NFKC", text)

    extractors = {
        "RC": _extract_rc_fields,
        "Insurance": _extract_insurance_fields,
        "DrivingLicense": _extract_dl_fields,
        "Fitness": _extract_fitness_fields,
        "PUC": _extract_puc_fields,
    }

    extractor = extractors.get(doc_type, _extract_other_fields)
    result = extractor(normalised_text)

    # Supplement with Hindi labels
    _supplement_with_localised_labels(normalised_text, result, _HINDI_LABELS)
    # Supplement with Tamil labels
    _supplement_with_localised_labels(normalised_text, result, _TAMIL_LABELS)

    return result


def run_ocr(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    doc_type: str = "auto",
    lang: str = "eng+hin",
) -> OCRResult:
    """
    Full OCR pipeline: preprocess → Tesseract → field extraction.

    Args:
        image_bytes: Raw bytes of the uploaded file.
        mime_type:   MIME type (used to handle PDFs).
        doc_type:    Known doc type or "auto" for auto-detection.
        lang:        Tesseract language string (e.g. "eng+hin+tam").

    Returns:
        OCRResult dataclass with raw_text, lines, extracted_fields,
        overall_confidence, doc_type_detected.
    """
    if not _TESS_AVAILABLE:
        return OCRResult(
            raw_text="",
            lines=[],
            extracted_fields={},
            overall_confidence=0.0,
            doc_type_detected="Other",
            error="pytesseract is not installed",
        )

    try:
        # 1. Convert PDF/HEIC to JPEG bytes if needed
        image_bytes = _load_image_bytes(image_bytes, mime_type)

        # 2. Pre-process
        if _CV2_AVAILABLE:
            np_img = preprocess_image(image_bytes)
            pil_img = _np_to_pil(np_img)
        else:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("L")

        # 3. Run Tesseract OCR
        tess_config = "--psm 6 --oem 3"
        raw_text: str = pytesseract.image_to_string(pil_img, lang=lang, config=tess_config)

        # 3b. If low-confidence, try lang detection and re-run with extra packs
        word_data_raw = pytesseract.image_to_data(
            pil_img, lang=lang, config=tess_config,
            output_type=pytesseract.Output.DICT,
        )
        confidences = [
            int(c) for c in word_data_raw.get("conf", [])
            if str(c).lstrip("-").isdigit() and int(c) >= 0
        ]
        overall_conf = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0

        # Re-run with detected language if confidence < 0.5
        if overall_conf < 0.5:
            detected_langs = detect_language(raw_text)
            new_lang = "+".join(dict.fromkeys(detected_langs + lang.split("+")))
            if new_lang != lang:
                try:
                    raw_text = pytesseract.image_to_string(
                        pil_img, lang=new_lang, config=tess_config
                    )
                except Exception:
                    pass  # Stick with original if new lang packs are unavailable

        # 4. Word-level bounding boxes (for frontend overlay)
        word_data = []
        n_boxes = len(word_data_raw.get("text", []))
        for i in range(n_boxes):
            w_text = word_data_raw["text"][i].strip()
            w_conf = word_data_raw["conf"][i]
            if w_text and str(w_conf).lstrip("-").isdigit() and int(w_conf) >= 0:
                word_data.append({
                    "text": w_text,
                    "confidence": int(w_conf) / 100.0,
                    "bbox": {
                        "x": word_data_raw["left"][i],
                        "y": word_data_raw["top"][i],
                        "w": word_data_raw["width"][i],
                        "h": word_data_raw["height"][i],
                    },
                })

        # 5. Detect document type
        effective_doc_type = (
            detect_doc_type(raw_text) if doc_type == "auto" else doc_type
        )

        # 6. Extract fields
        fields = extract_document_fields(raw_text, effective_doc_type)

        return OCRResult(
            raw_text=raw_text,
            lines=[l for l in raw_text.splitlines() if l.strip()],
            extracted_fields=fields,
            overall_confidence=round(overall_conf, 3),
            doc_type_detected=effective_doc_type,
            word_data=word_data,
        )

    except Exception as exc:
        logger.exception("OCR pipeline failed: %s", exc)
        return OCRResult(
            raw_text="",
            lines=[],
            extracted_fields={},
            overall_confidence=0.0,
            doc_type_detected="Other",
            error=str(exc),
        )
