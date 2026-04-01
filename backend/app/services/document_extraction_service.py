"""
Kavya Transports — Document Extraction Service
Uses Claude Sonnet 4.6 vision to extract structured data
from uploaded transport documents.
"""

import anthropic
import base64
import json
import os
import re
from datetime import datetime
from app.core.config import settings


# ─────────────────────────────────────────────────────────────
# EXTRACTION PROMPTS — one per uploadable document type
# ─────────────────────────────────────────────────────────────

EXTRACTION_PROMPTS: dict[str, str] = {

    "rc": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Registration Certificate (RC) image.

FIELDS TO EXTRACT:
1. registration_number   — Vehicle registration number
   (e.g., TN01AB1234, KA05CD5678)
2. owner_name            — Full name of the registered owner
3. make                  — Vehicle manufacturer / brand
   (e.g., TATA, Ashok Leyland, Mahindra, Eicher, BharatBenz)
4. model_name            — Vehicle model name / variant
   (e.g., Prima 4028, LPS 3523, Blazo 37)
5. year_of_manufacture   — Year the vehicle was manufactured (4-digit integer)
6. vehicle_class         — Class of vehicle
   (e.g., LMV, HMV, TRANS, MCWG, Motor Car)
7. fuel_type             — Fuel type
   (normalise to: Diesel / Petrol / CNG / Electric / LPG)
8. engine_number         — Engine number (may be partial)
9. chassis_number        — Chassis number (may be partial)
10. issue_date           — Date of issue of the RC
11. validity_date        — Validity / expiry date of the RC

EXTRACTION RULES:
- registration_number: appears prominently at the top; may also
  appear near labels "Reg No", "Registration No", "Vehicle No".
  Format: state-code (2 letters) + district-code (2 digits) +
  series (1-2 letters) + number (4 digits). Extract as-is.
- owner_name: extract the full name exactly as printed.
- make: the vehicle manufacturer brand. Look near labels like
  "Maker", "Manufacturer", "Make", "Brand". If not found: null.
- model_name: vehicle model. Look near labels like "Model",
  "Vehicle Model", "Type". If not found: null.
- year_of_manufacture: 4-digit integer year. Look near labels like
  "Year of Mfg", "Mfg. Year", "Year". If not found: null.
- vehicle_class: extract the class code or full description
  as printed on the document.
- fuel_type: normalise to one of:
  Diesel, Petrol, CNG, Electric, LPG — regardless of case.
- engine_number and chassis_number: may be partially masked
  (e.g., "XXXXX1234") — extract whatever digits are visible.
- All dates: normalise to DD/MM/YYYY format.
  Convert "01-MAR-2022" → "01/03/2022".
  Convert "2022/03/01" → "01/03/2022".

OUTPUT: Return ONLY a valid JSON object. No markdown, no
explanation, no extra text before or after the JSON.

{
  "registration_number": "TN01AB1234",
  "owner_name": "Kumar Selvam",
  "make": "TATA",
  "model_name": "Prima 4028",
  "year_of_manufacture": 2019,
  "vehicle_class": "HGV",
  "fuel_type": "Diesel",
  "engine_number": "XXXXX98765",
  "chassis_number": "XXXXX12345",
  "issue_date": "15/06/2021",
  "validity_date": "14/06/2026"
}

Set any field you cannot find to null. Do not guess.
""",

    "insurance": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Vehicle Insurance Certificate image.

FIELDS TO EXTRACT:
1. policy_number  — Insurance policy number
2. insurer_name   — Name of the insurance company
3. issue_date     — Date the policy was issued / started
4. expiry_date    — Date the policy expires
5. vehicle_number — Vehicle registration number this policy covers

EXTRACTION RULES:
- policy_number: appears near labels like "Policy No",
  "Certificate No", "Policy Number".
- insurer_name: the insurance company full official name.
- issue_date / expiry_date: both must be in DD/MM/YYYY format.
  "From" date = issue_date, "To" date = expiry_date.
- vehicle_number: the vehicle registration number.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "policy_number": "...",
  "insurer_name": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY",
  "vehicle_number": "..."
}

Set any field you cannot find to null. Do not guess.
""",

    "fitness": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Vehicle Fitness Certificate image.

FIELDS TO EXTRACT:
1. certificate_number — Fitness certificate number
2. vehicle_number     — Vehicle registration number
3. issue_date         — Date of issue
4. expiry_date        — Date of expiry

EXTRACTION RULES:
- certificate_number: appears near labels like "Cert No",
  "Fitness Cert No", "FC No".
- All dates: normalise to DD/MM/YYYY format.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "certificate_number": "...",
  "vehicle_number": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY"
}

Set any field you cannot find to null. Do not guess.
""",

    "puc": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Pollution Under Control (PUC) Certificate image.

FIELDS TO EXTRACT:
1. certificate_number — PUC certificate number
2. vehicle_number     — Vehicle registration number
3. test_date          — Date the emission test was conducted
4. valid_until        — Certificate validity / expiry date
5. reading_values     — Emission reading values from the test

EXTRACTION RULES:
- certificate_number: appears near labels like "Cert No", "PUC No".
- test_date / valid_until: normalise to DD/MM/YYYY format.
- reading_values: extract ALL emission readings as a nested object.
  Common readings:
    CO (Carbon Monoxide) → key "co_percent"
    HC (Hydrocarbons)    → key "hc_ppm"
    CO2                  → key "co2_percent"
    Smoke opacity        → key "smoke_opacity"
  If no readings found, return null for this field.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "certificate_number": "...",
  "vehicle_number": "...",
  "test_date": "DD/MM/YYYY",
  "valid_until": "DD/MM/YYYY",
  "reading_values": {"co_percent": "0.15", "hc_ppm": "85"}
}

Set any top-level field you cannot find to null. Do not guess.
""",

    "permit": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Vehicle Permit document image.

FIELDS TO EXTRACT:
1. permit_number  — Permit number / authorisation number
2. vehicle_number — Vehicle registration number
3. route_area     — Route or area this permit covers
4. issue_date     — Date of issue
5. expiry_date    — Date of expiry

EXTRACTION RULES:
- permit_number: appears near labels like "Permit No", "P.No".
- route_area: the permitted route or area (full text, max 200 chars).
- All dates: normalise to DD/MM/YYYY format.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "permit_number": "...",
  "vehicle_number": "...",
  "route_area": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY"
}

Set any field you cannot find to null. Do not guess.
""",

    "tax_receipt": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Road Tax Receipt image.

FIELDS TO EXTRACT:
1. receipt_number  — Receipt / challan / transaction number
2. vehicle_number  — Vehicle registration number
3. tax_amount      — Amount of road tax paid
4. valid_until     — Tax validity / next due date

EXTRACTION RULES:
- receipt_number: appears near labels like "Receipt No",
  "Transaction No", "Challan No", "MR No".
- tax_amount: include currency symbol if present.
- valid_until: normalise to DD/MM/YYYY format.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "receipt_number": "...",
  "vehicle_number": "...",
  "tax_amount": "₹5,200",
  "valid_until": "DD/MM/YYYY"
}

Set any field you cannot find to null. Do not guess.
""",

        "driving_license": """
Driver's License (DL)

You are a document data extraction assistant. When given a driver's license document (PDF or scanned document), extract the following fields accurately:
1. License Number
2. Issue Date
3. Validity Date

Rules:
- The license number may appear in two ways:
        a) At the TOP of the card with NO label — extract the first prominent alphanumeric value at the top.
        b) With a label such as "License No", "DL No", "Driving Licence Number", "No.", "DL#", or similar — extract the value next to that label.
- If both exist, prefer the labelled one as it is more reliable.
- Dates may appear in any format (DD/MM/YYYY, MM-DD-YYYY, DD MMM YYYY, etc.) — normalize them to DD/MM/YYYY in your output.
- Return the result strictly as JSON with keys: "license_number", "issue_date", "expiry_date".
- If a field is not found, set its value to null.
- Do not include any explanation or extra text — only return the JSON object.
""",

    "aadhaar": """
You are a precise document data extraction assistant specialised
in Indian government identity documents. Extract data from this
Aadhaar Card image.

FIELDS TO EXTRACT:
1. aadhaar_number — 12-digit Aadhaar identification number
2. full_name      — Full name of the Aadhaar holder
3. date_of_birth  — Date of birth
4. gender         — Gender of the holder
5. address        — Complete address printed on the Aadhaar

EXTRACTION RULES:
- aadhaar_number: always 12 digits, format "1234 5678 9012".
  Extract ONLY digits as 12-char string: "123456789012".
  If first 8 digits masked: return "XXXXXXXX" + last4.
- full_name: English name only (ignore regional script).
- date_of_birth: normalise to DD/MM/YYYY. If only year: return "1990".
- gender: normalise to "Male", "Female", or "Transgender".
- address: complete English address as single string.

PRIVACY RULE: Do NOT describe the photo, QR code, or biometrics.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "aadhaar_number": "123456789012",
  "full_name": "Kumar Selvam",
  "date_of_birth": "15/06/1990",
  "gender": "Male",
  "address": "12/3 Anna Nagar, Chennai, Tamil Nadu 600040"
}

Set any field you cannot find to null. Do not guess.
""",

    "driver_badge": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Driver Badge or Driver ID Card image.

FIELDS TO EXTRACT:
1. badge_number             — Badge number / ID number
2. driver_name              — Full name of the driver
3. issuing_authority        — Company or authority that issued this badge
4. issue_date               — Date the badge was issued
5. expiry_date              — Expiry / renewal date of the badge
6. vehicle_type_authorized  — Type of vehicle this driver is authorised to operate

EXTRACTION RULES:
- badge_number: appears near "Badge No", "ID No", "Driver ID".
- issue_date / expiry_date: normalise to DD/MM/YYYY format.
- vehicle_type_authorized: may say "Truck", "Tanker", "HGV" etc.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "badge_number": "...",
  "driver_name": "...",
  "issuing_authority": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY",
  "vehicle_type_authorized": "..."
}

Set any field you cannot find to null. Do not guess.
""",

    "medical_fitness": """
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Medical Fitness Certificate for a commercial vehicle driver.

FIELDS TO EXTRACT:
1. certificate_number — Certificate / registration number
2. driver_name        — Full name of the driver examined
3. date_of_birth      — Date of birth of the driver
4. examination_date   — Date the medical examination was done
5. valid_until        — Certificate validity / expiry date
6. doctor_name        — Name of the issuing doctor
7. hospital_name      — Name of the hospital or clinic
8. fitness_status     — Whether the driver is Fit or Unfit

EXTRACTION RULES:
- All dates: normalise to DD/MM/YYYY format.
- doctor_name: include "Dr." prefix if printed.
- fitness_status: normalise to exactly one of:
  "Fit", "Unfit", or "Conditionally Fit".

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "certificate_number": "...",
  "driver_name": "...",
  "date_of_birth": "DD/MM/YYYY",
  "examination_date": "DD/MM/YYYY",
  "valid_until": "DD/MM/YYYY",
  "doctor_name": "Dr. ...",
  "hospital_name": "...",
  "fitness_status": "Fit"
}

Set any field you cannot find to null. Do not guess.
""",

    "pan_card": """
You are a precise document data extraction assistant specialised
in Indian government documents. Extract data from this
PAN Card (Permanent Account Number) image.

FIELDS TO EXTRACT:
1. pan_number      — 10-character PAN alphanumeric code
2. full_name       — Full name of the PAN holder
3. date_of_birth   — Date of birth or date of incorporation
4. pan_holder_type — Type of PAN holder (inferred from 4th character)

EXTRACTION RULES:
- pan_number: always 10 chars, format 5 letters + 4 digits + 1 letter.
  Extract as uppercase with no spaces (e.g., ABCDE1234F).
- full_name: English name exactly as printed.
- date_of_birth: normalise to DD/MM/YYYY format.
- pan_holder_type: infer from 4th character of PAN:
  P → "Individual", C → "Company", H → "Hindu Undivided Family",
  F → "Firm / Partnership", A → "Association of Persons",
  B → "Body of Individuals", G → "Government",
  J → "Artificial Juridical Person", L → "Local Authority",
  T → "Trust"

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "pan_number": "ABCDE1234F",
  "full_name": "Kumar Selvam",
  "date_of_birth": "15/06/1990",
  "pan_holder_type": "Individual"
}

Set any field you cannot find to null. Do not guess.
""",

    "gst_certificate": """
You are a precise document data extraction assistant specialised
in Indian government business documents. Extract data from this
GST Registration Certificate image.

FIELDS TO EXTRACT:
1. gstin             — GST Identification Number (15 characters)
2. legal_name        — Legal name of the registered business
3. trade_name        — Trade name (if explicitly labelled)
4. registration_date — Date of GST registration
5. business_type     — Type of business entity
6. principal_address — Principal place of business address
7. gst_status        — Current status of the GST registration

EXTRACTION RULES:
- gstin: always 15 characters, uppercase, no spaces.
  Format: 2-digit state code + 10-char PAN + entity no + check chars.
- trade_name: return null if not explicitly labelled "Trade Name".
- registration_date: normalise to DD/MM/YYYY format.
- business_type: normalise to one of:
  "Proprietorship", "Partnership", "LLP", "Private Limited",
  "Public Limited", "Trust", "Society", "Government", "Other"
- gst_status: normalise to one of:
  "Active", "Inactive", "Cancelled", "Suspended"

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "gstin": "33AABCT1332L1ZD",
  "legal_name": "...",
  "trade_name": null,
  "registration_date": "DD/MM/YYYY",
  "business_type": "Private Limited",
  "principal_address": "...",
  "gst_status": "Active"
}

Set any field you cannot find to null. Do not guess.
""",
}


# ─────────────────────────────────────────────────────────────
# SYSTEM-GENERATED document types — no extraction performed
# ─────────────────────────────────────────────────────────────

SYSTEM_GENERATED_TYPES: set[str] = {
    "invoice",
    "eway_bill",
    "lr_copy",
    "contract",
    "pod",
    "other",
}

DOCUMENT_TYPE_ALIASES: dict[str, str] = {
    "license": "driving_license",
}


# ─────────────────────────────────────────────────────────────
# ENTITY → DOCUMENT REQUIREMENTS CONFIG
# ─────────────────────────────────────────────────────────────

ENTITY_DOCUMENTS: dict = {
    "vehicle": {
        "required": [
            {
                "type": "rc",
                "label": "Registration Certificate (RC)",
                "description": "Vehicle registration issued by RTO",
                "icon": "file-text",
                "auto_fills": ["registration_number", "fuel_type", "vehicle_class"],
            },
            {
                "type": "insurance",
                "label": "Insurance Certificate",
                "description": "Comprehensive or third-party insurance",
                "icon": "shield",
                "auto_fills": [],
            },
            {
                "type": "fitness",
                "label": "Fitness Certificate",
                "description": "Vehicle roadworthiness certificate from RTO",
                "icon": "check-circle",
                "auto_fills": [],
            },
            {
                "type": "puc",
                "label": "PUC Certificate",
                "description": "Pollution under control emission certificate",
                "icon": "wind",
                "auto_fills": [],
            },
        ],
        "optional": [
            {
                "type": "permit",
                "label": "Permit",
                "description": "Commercial vehicle permit — state / all-India",
                "icon": "map",
                "auto_fills": [],
            },
            {
                "type": "tax_receipt",
                "label": "Road Tax Receipt",
                "description": "Road tax payment receipt",
                "icon": "receipt",
                "auto_fills": [],
            },
        ],
    },
    "driver": {
        "required": [
            {
                "type": "driving_license",
                "label": "Driving License",
                "description": "Valid commercial driving license",
                "icon": "credit-card",
                "auto_fills": ["license_number", "date_of_birth", "license_classes"],
            },
            {
                "type": "aadhaar",
                "label": "Aadhaar Card",
                "description": "Government-issued identity proof",
                "icon": "user",
                "auto_fills": ["full_name", "date_of_birth", "address"],
            },
        ],
        "optional": [],
    },
    "employee": {
        "required": [
            {
                "type": "aadhaar",
                "label": "Aadhaar Card",
                "description": "Government-issued identity proof",
                "icon": "user",
                "auto_fills": ["full_name", "date_of_birth", "address"],
            },
        ],
        "optional": [
            {
                "type": "pan_card",
                "label": "PAN Card",
                "description": "Required for salary TDS deduction",
                "icon": "credit-card",
                "auto_fills": [],
            },
        ],
    },
    "client": {
        "required": [
            {
                "type": "gst_certificate",
                "label": "GST Registration Certificate",
                "description": "GST registration — required for billing and e-way bills",
                "icon": "file-badge",
                "auto_fills": ["gstin", "legal_name", "principal_address"],
            },
        ],
        "optional": [
            {
                "type": "pan_card",
                "label": "PAN Card",
                "description": "PAN for TDS compliance",
                "icon": "credit-card",
                "auto_fills": [],
            },
        ],
    },
}

# ─────────────────────────────────────────────────────────────
# EXPIRY FIELD NAMES per document type
# ─────────────────────────────────────────────────────────────

EXPIRY_FIELDS: dict[str, str] = {
    "rc": "validity_date",
    "insurance": "expiry_date",
    "fitness": "expiry_date",
    "puc": "valid_until",
    "permit": "expiry_date",
    "tax_receipt": "valid_until",
    "driving_license": "expiry_date",
    "driver_badge": "expiry_date",
    "medical_fitness": "valid_until",
}

ISSUE_DATE_FIELDS: dict[str, str] = {
    "rc": "issue_date",
    "insurance": "issue_date",
    "fitness": "issue_date",
    "puc": "test_date",
    "permit": "issue_date",
    "driving_license": "issue_date",
    "driver_badge": "issue_date",
    "medical_fitness": "examination_date",
    "gst_certificate": "registration_date",
}

# Mapping from API lowercase type → DB DocumentType enum value
DOC_TYPE_TO_ENUM: dict[str, str] = {
    "rc": "RC",
    "insurance": "INSURANCE",
    "fitness": "FITNESS",
    "puc": "PUC",
    "permit": "PERMIT",
    "tax_receipt": "TAX_RECEIPT",
    "driving_license": "LICENSE",
    "aadhaar": "AADHAAR",
    "driver_badge": "DRIVER_BADGE",
    "medical_fitness": "MEDICAL_FITNESS",
    "pan_card": "PAN_CARD",
    "gst_certificate": "GST_CERTIFICATE",
    "invoice": "INVOICE",
    "eway_bill": "EWAY_BILL",
    "lr_copy": "LR_COPY",
    "contract": "CONTRACT",
    "pod": "POD",
    "other": "OTHER",
}


# ─────────────────────────────────────────────────────────────
# DOCUMENT EXTRACTION SERVICE
# ─────────────────────────────────────────────────────────────

class DocumentExtractionService:
    """
    Calls Claude Sonnet 4.6 vision API to extract structured data
    from uploaded transport document images or PDFs.
    """

    MODEL = "claude-sonnet-4-6"
    MAX_TOKENS = 1024

    def __init__(self):
        # Lazy client — actual init happens in extract() so missing key
        # returns a clean error dict instead of crashing with 500.
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            api_key = settings.ANTHROPIC_API_KEY or ""
            if not api_key or api_key == "your-anthropic-api-key-here":
                raise ValueError(
                    "ANTHROPIC_API_KEY is not configured. "
                    "Set it in backend/.env to enable AI document extraction."
                )
            self._client = anthropic.AsyncAnthropic(api_key=api_key)
        return self._client

    async def extract(
        self,
        document_type: str,
        file_bytes: bytes,
        media_type: str,
    ) -> dict:
        """
        Extract structured data from a document image or PDF.

        Returns dict with keys:
          extracted (bool)
          document_type (str)
          data (dict) — on success
          reason (str) — on skip or failure
          message (str) — human-readable description
        """

        normalized_document_type = DOCUMENT_TYPE_ALIASES.get(document_type, document_type)

        if normalized_document_type in SYSTEM_GENERATED_TYPES:
            return {
                "extracted": False,
                "reason": "system_generated",
                "message": "This document type is generated by the system "
                           "and does not require extraction.",
            }

        if normalized_document_type not in EXTRACTION_PROMPTS:
            return {
                "extracted": False,
                "reason": "unknown_type",
                "message": f"No extraction prompt defined for '{document_type}'.",
            }

        if normalized_document_type == "driving_license":
            return self._extract_driving_license_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "rc":
            return self._extract_rc_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "insurance":
            return self._extract_insurance_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "puc":
            return self._extract_puc_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "fitness":
            return self._extract_fitness_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "tax_receipt":
            return self._extract_tax_receipt_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        if normalized_document_type == "permit":
            return self._extract_permit_tesseract(
                file_bytes=file_bytes,
                media_type=media_type,
                document_type=document_type,
            )

        # Check API key early — gives a 422 instead of 500
        try:
            client = self._get_client()
        except ValueError as e:
            return {
                "extracted": False,
                "reason": "api_key_missing",
                "message": str(e),
            }

        prompt = EXTRACTION_PROMPTS[normalized_document_type]

        if media_type == "application/pdf":
            try:
                file_bytes, media_type = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            message = await client.messages.create(
                model=self.MODEL,
                max_tokens=self.MAX_TOKENS,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": base64.b64encode(file_bytes).decode(),
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt,
                            },
                        ],
                    }
                ],
            )
        except anthropic.APIError as e:
            return {
                "extracted": False,
                "reason": "api_error",
                "message": f"AI service error: {str(e)}",
            }
        except Exception as e:
            return {
                "extracted": False,
                "reason": "unexpected_error",
                "message": f"Unexpected error during extraction: {str(e)}",
            }

        raw = message.content[0].text.strip()
        raw = self._strip_code_fences(raw)

        try:
            extracted_data = json.loads(raw)
        except json.JSONDecodeError:
            return {
                "extracted": False,
                "reason": "parse_error",
                "raw": raw,
                "message": "Could not parse extracted data. "
                           "Try a clearer image and upload again.",
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": extracted_data,
        }

    def _extract_driving_license_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key DL fields via Tesseract OCR (offline path)."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_driving_license_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect license number or dates from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_rc_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key RC fields via Tesseract OCR (offline path)."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_rc_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect RC fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_insurance_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key insurance fields via Tesseract OCR (offline path)."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_insurance_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect insurance fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_puc_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key PUC fields via Tesseract OCR (offline path)."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_puc_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect PUC fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_fitness_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key fitness certificate fields via Tesseract OCR."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_fitness_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect fitness fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_tax_receipt_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key road-tax receipt fields via Tesseract OCR."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_tax_receipt_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect tax receipt fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _extract_permit_tesseract(
        self,
        file_bytes: bytes,
        media_type: str,
        document_type: str,
    ) -> dict:
        """Extract key permit fields via Tesseract OCR."""
        try:
            from PIL import Image, ImageOps
            import io
            import pytesseract
        except Exception as e:
            return {
                "extracted": False,
                "reason": "tesseract_unavailable",
                "message": f"Tesseract OCR dependencies are missing: {str(e)}",
            }

        current_tesseract_cmd = getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")
        if os.name == "nt" and not os.path.exists(current_tesseract_cmd):
            win_candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for candidate in win_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        if media_type == "application/pdf":
            try:
                file_bytes, _ = self._pdf_to_image(file_bytes)
            except Exception as e:
                return {
                    "extracted": False,
                    "reason": "pdf_conversion_error",
                    "message": f"Could not read PDF: {str(e)}",
                }

        try:
            image = Image.open(io.BytesIO(file_bytes)).convert("L")
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--oem 3 --psm 6") or ""
        except Exception as e:
            return {
                "extracted": False,
                "reason": "ocr_error",
                "message": f"Tesseract OCR failed: {str(e)}",
            }

        data = self._parse_permit_text(text)
        if not any(v is not None for v in data.values()):
            return {
                "extracted": False,
                "reason": "no_fields",
                "message": "Could not detect permit fields from the document.",
                "data": data,
            }

        return {
            "extracted": True,
            "document_type": document_type,
            "data": data,
        }

    def _parse_rc_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        registration_number = self._extract_registration_number(cleaned_upper, lines)
        owner_name = self._extract_rc_labeled_text(
            cleaned,
            [
                r"OWNER\s*NAME",
                r"NAME\s*OF\s*OWNER",
            ],
            max_chars=120,
        )
        vehicle_class = self._extract_rc_labeled_text(
            cleaned,
            [
                r"VEHICLE\s*CLASS",
                r"CLASS\s*OF\s*VEHICLE",
            ],
            max_chars=60,
        )
        fuel_type = self._normalize_fuel_type(
            self._extract_rc_labeled_text(
                cleaned,
                [
                    r"FUEL\s*USED",
                    r"FUEL\s*TYPE",
                ],
                max_chars=40,
            )
        )
        engine_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"ENGINE\s*NO\.?",
                r"ENGINE\s*NUMBER",
            ],
            max_chars=60,
        )
        chassis_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"CHASSIS\s*NO\.?",
                r"CHASSIS\s*NUMBER",
            ],
            max_chars=60,
        )
        issue_date = self._extract_date_from_line_context(
            lines,
            [
                r"DATE\s*OF\s*REGISTRATION",
                r"REGISTRATION\s*DATE",
            ],
            pick="first",
        )
        validity_date = self._extract_date_from_line_context(
            lines,
            [
                r"VALID\s*UPTO",
                r"VALIDITY",
                r"VALID\s*TILL",
                r"RC\s*VALID\s*TILL",
            ],
            pick="latest",
        )

        if not issue_date or not validity_date:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                if not issue_date:
                    issue_date = all_dates[0]
                if not validity_date:
                    validity_date = all_dates[-1]

        return {
            "registration_number": registration_number,
            "owner_name": owner_name,
            "vehicle_class": vehicle_class,
            "fuel_type": fuel_type,
            "engine_number": engine_number,
            "chassis_number": chassis_number,
            "issue_date": issue_date,
            "validity_date": validity_date,
        }

    def _parse_insurance_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        policy_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"POLICY\s*NO\.?",
                r"CERTIFICATE\s*NO\.?",
                r"POLICY\s*NUMBER",
            ],
            max_chars=60,
        )

        insurer_name = self._extract_rc_labeled_text(
            cleaned,
            [
                r"NAME\s*OF\s*INSURER",
                r"INSURANCE\s*COMPANY",
                r"INSURED\s*BY",
            ],
            max_chars=120,
        )

        vehicle_number = self._extract_registration_number(cleaned_upper, lines)

        issue_date = self._extract_date_from_line_context(
            lines,
            [
                r"POLICY\s*ISSUE\s*DATE",
                r"DATE\s*OF\s*ISSUE",
                r"COMMENCEMENT\s*DATE",
            ],
            pick="first",
        )

        expiry_date = self._extract_date_from_line_context(
            lines,
            [
                r"POLICY\s*EXPIRY\s*DATE",
                r"DATE\s*OF\s*EXPIRY",
                r"VALID\s*TILL",
                r"EXPIRY\s*DATE",
            ],
            pick="latest",
        )

        if not issue_date or not expiry_date:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                if not issue_date:
                    issue_date = all_dates[0]
                if not expiry_date:
                    expiry_date = all_dates[-1]

        return {
            "policy_number": policy_number,
            "insurer_name": insurer_name,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
            "vehicle_number": vehicle_number,
        }

    def _parse_puc_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        certificate_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"PUC\s*CERT\.?\s*NO\.?",
                r"CERTIFICATE\s*NO\.?",
                r"TEST\s*CERTIFICATE\s*NO\.?",
                r"CERT\s*NO\.?",
                r"PUC\s*NO\.?",
            ],
            max_chars=60,
        )

        vehicle_number = self._extract_registration_number(cleaned_upper, lines)

        test_date = self._extract_date_from_line_context(
            lines,
            [
                r"DATE\s*OF\s*TEST",
                r"TEST\s*DATE",
                r"TESTED\s*ON",
            ],
            pick="first",
        )

        valid_until = self._extract_date_from_line_context(
            lines,
            [
                r"VALID\s*UPTO",
                r"VALID\s*TILL",
                r"CERTIFICATE\s*VALID\s*TILL",
            ],
            pick="latest",
        )

        if not test_date or not valid_until:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                if not test_date:
                    test_date = all_dates[0]
                if not valid_until:
                    valid_until = all_dates[-1]

        reading_values = self._extract_puc_readings(cleaned)

        return {
            "certificate_number": certificate_number,
            "vehicle_number": vehicle_number,
            "test_date": test_date,
            "valid_until": valid_until,
            "reading_values": reading_values,
        }

    def _parse_fitness_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        certificate_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"CERTIFICATE\s*NO\.?",
                r"FITNESS\s*CERT\.?\s*NO\.?",
                r"FC\s*NO\.?",
                r"CERT\s*NO\.?",
                r"FITNESS\s*CERT\s*NO\.?",
            ],
            max_chars=60,
        )
        vehicle_number = self._extract_registration_number(cleaned_upper, lines)

        issue_date = self._extract_date_from_line_context(
            lines,
            [
                r"DATE\s*OF\s*ISSUE",
                r"ISSUE\s*DATE",
                r"FC\s*ISSUE\s*DATE",
            ],
            pick="first",
        )
        expiry_date = self._extract_date_from_line_context(
            lines,
            [
                r"VALID\s*UPTO",
                r"EXPIRY\s*DATE",
                r"FC\s*VALID\s*TILL",
                r"VALID\s*TILL",
            ],
            pick="latest",
        )

        if not issue_date or not expiry_date:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                if not issue_date:
                    issue_date = all_dates[0]
                if not expiry_date:
                    expiry_date = all_dates[-1]

        return {
            "certificate_number": certificate_number,
            "vehicle_number": vehicle_number,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
        }

    def _parse_tax_receipt_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        receipt_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"RECEIPT\s*NO\.?",
                r"TRANSACTION\s*NO\.?",
                r"CHALLAN\s*NO\.?",
                r"TAX\s*RECEIPT\s*NO\.?",
            ],
            max_chars=60,
        )
        vehicle_number = self._extract_registration_number(cleaned_upper, lines)
        tax_amount = self._extract_tax_amount(cleaned)
        valid_until = self._extract_date_from_line_context(
            lines,
            [
                r"VALID\s*UPTO",
                r"TAX\s*VALID\s*TILL",
                r"VALIDITY",
            ],
            pick="latest",
        )

        if not valid_until:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                valid_until = all_dates[-1]

        return {
            "receipt_number": receipt_number,
            "vehicle_number": vehicle_number,
            "tax_amount": tax_amount,
            "valid_until": valid_until,
        }

    def _parse_permit_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        cleaned_upper = cleaned.upper()
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        permit_number = self._extract_rc_labeled_text(
            cleaned,
            [
                r"PERMIT\s*NO\.?",
                r"AUTHORI[ZS]ATION\s*NO\.?",
                r"PERMIT\s*NUMBER",
            ],
            max_chars=60,
        )
        vehicle_number = self._extract_registration_number(cleaned_upper, lines)
        route_area = self._extract_rc_labeled_text(
            cleaned,
            [
                r"ROUTE\s*AUTHORI[ZS]ED",
                r"AREA\s*OF\s*OPERATION",
                r"PERMIT\s*AREA",
                r"ROUTE",
            ],
            max_chars=200,
        )

        issue_date = self._extract_date_from_line_context(
            lines,
            [
                r"DATE\s*OF\s*ISSUE",
                r"ISSUE\s*DATE",
                r"PERMIT\s*ISSUE\s*DATE",
            ],
            pick="first",
        )
        expiry_date = self._extract_date_from_line_context(
            lines,
            [
                r"VALID\s*UPTO",
                r"EXPIRY\s*DATE",
                r"PERMIT\s*VALID\s*TILL",
            ],
            pick="latest",
        )

        if not issue_date or not expiry_date:
            all_dates = self._sort_dates_unique(self._extract_all_dates(cleaned))
            if all_dates:
                if not issue_date:
                    issue_date = all_dates[0]
                if not expiry_date:
                    expiry_date = all_dates[-1]

        return {
            "permit_number": permit_number,
            "vehicle_number": vehicle_number,
            "route_area": route_area,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
        }

    def _extract_puc_readings(self, text: str) -> dict | None:
        fields = [
            ("CO% Vol", r"CO\s*%\s*VOL"),
            ("HC (PPM)", r"HC\s*\(?\s*PPM\s*\)?"),
            ("CO2%", r"CO2\s*%"),
            ("Idle CO%", r"IDLE\s*CO\s*%"),
            ("High Idle HC", r"HIGH\s*IDLE\s*HC"),
        ]
        out: dict[str, str] = {}

        for label, rx in fields:
            pattern = re.compile(rx + r"\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE)
            match = pattern.search(text)
            if match:
                out[label] = match.group(1)

        return out or None

    def _extract_tax_amount(self, text: str) -> str | None:
        labels = [
            r"TAX\s*AMOUNT",
            r"AMOUNT\s*PAID",
            r"TAX\s*PAID",
            r"TOTAL\s*AMOUNT",
        ]
        for label in labels:
            pattern = re.compile(label + r"\s*[:=\-]?\s*([₹Rs\.\s]*\d[\d,]*(?:\.\d{1,2})?)", re.IGNORECASE)
            match = pattern.search(text)
            if not match:
                continue
            raw = re.sub(r"\s+", " ", match.group(1)).strip()
            if "₹" in raw:
                return raw
            if re.search(r"\bRS\.?\b", raw, re.IGNORECASE):
                return raw
            return raw
        return None

    def _extract_registration_number(self, cleaned_upper: str, lines: list[str]) -> str | None:
        labeled_pattern = re.compile(
            r"(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|REG\.\s*NO\.?|VEHICLE\s*NO\.?|REGN\s*NO\.?)\s*[:\-]?\s*([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4})",
            re.IGNORECASE,
        )
        labeled_match = labeled_pattern.search(cleaned_upper)
        if labeled_match:
            normalized = self._normalize_registration_number(labeled_match.group(1))
            if normalized:
                return normalized

        top_pattern = re.compile(r"\b[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{3,4}\b")
        for ln in lines[:8]:
            match = top_pattern.search(ln.upper())
            if match:
                normalized = self._normalize_registration_number(match.group(0))
                if normalized:
                    return normalized
        return None

    def _normalize_registration_number(self, raw: str | None) -> str | None:
        if not raw:
            return None

        value = re.sub(r"[^A-Z0-9]", "", raw.upper())
        match = re.fullmatch(r"([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{3,4})", value)
        if not match:
            return None

        state, district, series, number = match.groups()

        # OCR on Tamil Nadu RCs commonly reads TN as IN due to low-contrast top row.
        if state == "IN":
            state = "TN"

        return f"{state}{district}{series}{number}"

    def _extract_rc_labeled_text(self, text: str, labels: list[str], max_chars: int = 80) -> str | None:
        for label in labels:
            pattern = re.compile(label + r"\s*[:\-]?\s*([^\n]{1," + str(max_chars) + r"})", re.IGNORECASE)
            match = pattern.search(text)
            if not match:
                continue

            value = match.group(1).strip(" :.-")
            # Trim value if OCR captured the next inline label.
            value = re.split(
                r"\s{2,}|\b(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|FUEL\s*(?:TYPE|USED)|ENGINE\s*(?:NO|NUMBER)|CHASSIS\s*(?:NO|NUMBER)|DATE|VALID(?:ITY|\s*TILL|\s*UPTO))\b",
                value,
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0].strip(" :.-")
            return value or None
        return None

    def _normalize_fuel_type(self, value: str | None) -> str | None:
        if not value:
            return None
        text = value.strip().lower()
        if "diesel" in text:
            return "Diesel"
        if "petrol" in text:
            return "Petrol"
        if "cng" in text:
            return "CNG"
        if "electric" in text or "ev" == text:
            return "Electric"
        if "lpg" in text:
            return "LPG"
        return value.strip()

    def _parse_driving_license_text(self, text: str) -> dict:
        cleaned = re.sub(r"[\t\r]+", " ", text or "")
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        label_pattern = re.compile(
            r"(?:LICENSE\s*(?:NO|NUMBER|#)?|LICENCE\s*(?:NO|NUMBER|#)?|DL\s*(?:NO|NUMBER|#)?|DRIVING\s+LICEN[CS]E\s*(?:NO|NUMBER)?)\s*[:\-]?\s*([A-Z0-9\-/\s]{6,32})",
            re.IGNORECASE,
        )
        label_match = label_pattern.search(cleaned)
        labeled_license = self._normalize_license_token(label_match.group(1)) if label_match else None
        if labeled_license and not self._is_probable_driving_license_number(labeled_license):
            labeled_license = None

        top_candidate = self._extract_driving_license_number_from_lines(lines)

        if not top_candidate:
            token_pattern = re.compile(r"\b[A-Z0-9\-/]{6,25}\b")
            for ln in lines[:8]:
                for tok in token_pattern.findall(ln.upper()):
                    normalized = self._normalize_license_token(tok)
                    if normalized and self._is_probable_driving_license_number(normalized):
                        top_candidate = normalized
                        break
                if top_candidate:
                    break

        license_number = labeled_license or top_candidate

        issue_date = self._extract_date_from_line_context(
            lines,
            [
                r"(?:I|L)SSUE\s*DATE",
                r"DATE\s*OF\s*ISSUE",
                r"ISSUED\s*ON",
                r"\bDOI\b",
            ],
            pick="first",
        )

        validity_dates = self._extract_labeled_dates(
            cleaned,
            r"(?:VALIDITY\s*(?:\(\s*(?:NT|TR)\s*\))?|VALID\s*(?:UPTO|UNTIL|TILL|TO)|EXPIRY\s*DATE|DATE\s*OF\s*EXPIRY|EXPIRES\s*ON|VALID\s*\(\s*(?:NT|TR)\s*\))",
        )

        # Also scan line context for validity labels because OCR can split labels and dates.
        for p in [r"VALIDITY", r"VALID\s*(?:UPTO|UNTIL|TILL|TO)", r"EXPIRY", r"\bNT\b", r"\bTR\b"]:
            d = self._extract_date_from_line_context(lines, [p], pick="latest")
            if d:
                validity_dates.append(d)

        # Remove probable DOB values from validity pool.
        validity_dates = [
            d for d in validity_dates
            if d not in self._extract_labeled_dates(cleaned, r"(?:DATE\s*OF\s*BIRTH|DOB|BIRTH)")
        ]
        expiry_date = self._pick_latest_date(validity_dates)

        if not issue_date:
            issue_from_validity = self._extract_labeled_date(
                cleaned,
                r"(?:VALID\s*FROM|VALIDITY\s*FROM)",
            )
            if issue_from_validity:
                issue_date = issue_from_validity

        if not issue_date or not expiry_date:
            all_dates = self._extract_all_dates(cleaned)
            dob_dates = self._extract_labeled_dates(cleaned, r"(?:DATE\s*OF\s*BIRTH|DOB|BIRTH)")
            all_dates = [d for d in all_dates if d not in dob_dates]
            if all_dates:
                unique_dates = self._sort_dates_unique(all_dates)
                if not issue_date:
                    issue_date = unique_dates[0]
                if not expiry_date:
                    expiry_date = unique_dates[-1]

        return {
            "license_number": license_number,
            "issue_date": issue_date,
            "expiry_date": expiry_date,
        }

    def _normalize_license_token(self, value: str | None) -> str | None:
        if not value:
            return None
        compact = re.sub(r"[^A-Z0-9]", "", value.upper())
        return compact or None

    def _is_probable_driving_license_number(self, value: str | None) -> bool:
        compact = self._normalize_license_token(value)
        if not compact:
            return False
        if len(compact) < 10 or len(compact) > 18:
            return False
        if not re.match(r"^[A-Z]{2}\d", compact):
            return False
        if not re.search(r"\d{4}", compact):
            return False
        if compact in {"GOVERNMENT", "INDIA", "DRIVING", "LICENCE", "LICENSE"}:
            return False
        return True

    def _extract_driving_license_number_from_lines(self, lines: list[str]) -> str | None:
        line_pattern = re.compile(
            r"\b([A-Z]{2}\s*[-/]?\s*\d{1,2}\s*[-/]?\s*\d{4}\s*[-/]?\s*\d{5,8})\b",
            re.IGNORECASE,
        )

        for ln in lines[:12]:
            line_upper = ln.upper()

            # Direct match for common Indian DL pattern.
            for match in line_pattern.findall(line_upper):
                normalized = self._normalize_license_token(match)
                if self._is_probable_driving_license_number(normalized):
                    return normalized

            # OCR often splits DL as: "TN72 20240005499" or "TN72 2024 0005499".
            tokens = re.findall(r"[A-Z0-9]{2,}", line_upper)
            for i, token in enumerate(tokens):
                if not re.fullmatch(r"[A-Z]{2}\d{1,2}", token):
                    continue

                if i + 1 < len(tokens) and re.fullmatch(r"\d{9,12}", tokens[i + 1]):
                    candidate = self._normalize_license_token(token + tokens[i + 1])
                    if self._is_probable_driving_license_number(candidate):
                        return candidate

                if (
                    i + 2 < len(tokens)
                    and re.fullmatch(r"\d{4}", tokens[i + 1])
                    and re.fullmatch(r"\d{5,8}", tokens[i + 2])
                ):
                    candidate = self._normalize_license_token(token + tokens[i + 1] + tokens[i + 2])
                    if self._is_probable_driving_license_number(candidate):
                        return candidate

        # Last fallback: generic alphanumeric token scan in upper section.
        generic_pattern = re.compile(r"\b[A-Z0-9\-/]{8,25}\b")
        for ln in lines[:12]:
            for token in generic_pattern.findall(ln.upper()):
                normalized = self._normalize_license_token(token)
                if self._is_probable_driving_license_number(normalized):
                    return normalized

        return None

    def _extract_labeled_date(self, text: str, label_regex: str) -> str | None:
        pattern = re.compile(label_regex + r"\s*[:\-]?\s*([0-9A-Za-z\-/\. ]{6,20})", re.IGNORECASE)
        m = pattern.search(text)
        if not m:
            return None
        return self._normalize_date(m.group(1))

    def _extract_date_from_line_context(self, lines: list[str], label_patterns: list[str], pick: str = "first") -> str | None:
        compiled = [re.compile(p, re.IGNORECASE) for p in label_patterns]
        date_finder = re.compile(r"\b(?:\d{2}[\-/]\d{2}[\-/]\d{4}|\d{4}[\-/]\d{2}[\-/]\d{2}|\d{2}\s+[A-Za-z]{3,9}\s+\d{4})\b")

        for i, line in enumerate(lines):
            if not any(p.search(line) for p in compiled):
                continue

            # Check current line first, then adjacent lines (OCR often wraps dates).
            window = [line]
            if i + 1 < len(lines):
                window.append(lines[i + 1])
            if i > 0:
                window.append(lines[i - 1])

            for w in window:
                found_dates: list[str] = []
                for token in date_finder.findall(w):
                    normalized = self._normalize_date(token)
                    if normalized:
                        found_dates.append(normalized)
                if found_dates:
                    ordered = self._sort_dates_unique(found_dates)
                    return ordered[-1] if pick == "latest" else ordered[0]
        return None

    def _extract_labeled_dates(self, text: str, label_regex: str) -> list[str]:
        pattern = re.compile(label_regex + r"\s*[:\-]?\s*([0-9A-Za-z\-/\. ]{6,20})", re.IGNORECASE)
        matches = pattern.findall(text)
        out: list[str] = []
        for m in matches:
            for token in re.findall(
                r"\b(?:\d{2}[\-/]\d{2}[\-/]\d{4}|\d{4}[\-/]\d{2}[\-/]\d{2}|\d{2}\s+[A-Za-z]{3,9}\s+\d{4})\b",
                m,
            ):
                normalized = self._normalize_date(token)
                if normalized:
                    out.append(normalized)
        return out

    def _extract_all_dates(self, text: str) -> list[str]:
        candidates = re.findall(
            r"\b(?:\d{2}[\-/]\d{2}[\-/]\d{4}|\d{4}[\-/]\d{2}[\-/]\d{2}|\d{2}\s+[A-Za-z]{3,9}\s+\d{4})\b",
            text,
        )
        out: list[str] = []
        for c in candidates:
            normalized = self._normalize_date(c)
            if normalized:
                out.append(normalized)
        return out

    def _normalize_date(self, raw: str | None) -> str | None:
        if not raw:
            return None
        value = re.sub(r"\s+", " ", raw.strip())
        formats = [
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y/%m/%d",
            "%Y-%m-%d",
            "%d %b %Y",
            "%d %B %Y",
            "%m-%d-%Y",
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.strftime("%d/%m/%Y")
            except ValueError:
                continue
        return None

    def _sort_dates_unique(self, dates: list[str]) -> list[str]:
        parsed: list[tuple[datetime, str]] = []
        seen: set[str] = set()
        for d in dates:
            if d in seen:
                continue
            seen.add(d)
            try:
                parsed.append((datetime.strptime(d, "%d/%m/%Y"), d))
            except ValueError:
                continue
        parsed.sort(key=lambda x: x[0])
        return [d for _, d in parsed]

    def _pick_latest_date(self, dates: list[str]) -> str | None:
        ordered = self._sort_dates_unique(dates)
        if not ordered:
            return None
        return ordered[-1]

    def _pdf_to_image(self, pdf_bytes: bytes) -> tuple[bytes, str]:
        """Convert first page of a PDF to JPEG bytes."""
        from pdf2image import convert_from_bytes
        import io
        pages = convert_from_bytes(
            pdf_bytes, first_page=1, last_page=1, dpi=200
        )
        buf = io.BytesIO()
        pages[0].save(buf, format="JPEG", quality=90)
        return buf.getvalue(), "image/jpeg"

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        """Remove markdown ```json ... ``` wrapping if present."""
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        return text.strip()
