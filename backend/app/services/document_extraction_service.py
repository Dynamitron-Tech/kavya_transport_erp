"""
Kavya Transports — Document Extraction Service
Uses Claude Sonnet 4.6 vision to extract structured data
from uploaded transport documents.
"""

import anthropic
import base64
import json
import re
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
You are a precise document data extraction assistant specialised
in Indian transport documents. Extract data from this
Driving License (DL) image.

FIELDS TO EXTRACT:
1. license_number     — Driving license number
2. holder_name        — Full name of the license holder
3. date_of_birth      — Date of birth of the holder
4. issue_date         — Date the license was issued
5. expiry_date        — Date the license expires
6. license_classes    — All vehicle classes authorised on this DL
7. issuing_authority  — The RTO or authority that issued it

EXTRACTION RULES:
- license_number: appears near "DL No", "License No".
- holder_name: full name in English only.
- date_of_birth / issue_date / expiry_date: normalise to DD/MM/YYYY.
- license_classes: extract ALL class codes as an array.
  Common: MCWG, LMV, LMV-TR, HMV, HGV, TRANS, MGV, HPMV, HGMV.
  Example: ["LMV", "TRANS", "HGV"]. Empty array [] if not found.
- issuing_authority: the RTO name or code.

OUTPUT: Return ONLY a valid JSON object. No markdown.

{
  "license_number": "TN0120220012345",
  "holder_name": "Kumar Selvam",
  "date_of_birth": "15/06/1990",
  "issue_date": "01/03/2022",
  "expiry_date": "28/02/2040",
  "license_classes": ["LMV", "TRANS"],
  "issuing_authority": "RTO Chennai"
}

Set any field you cannot find to null.
license_classes should be [] if not found. Do not guess.
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
            {
                "type": "medical_fitness",
                "label": "Medical Fitness Certificate",
                "description": "Doctor-certified fitness for commercial driving",
                "icon": "activity",
                "auto_fills": [],
            },
        ],
        "optional": [
            {
                "type": "driver_badge",
                "label": "Driver Badge / ID Card",
                "description": "Company or transport authority driver badge",
                "icon": "badge",
                "auto_fills": [],
            },
        ],
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
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY
        )

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

        if document_type in SYSTEM_GENERATED_TYPES:
            return {
                "extracted": False,
                "reason": "system_generated",
                "message": "This document type is generated by the system "
                           "and does not require extraction.",
            }

        if document_type not in EXTRACTION_PROMPTS:
            return {
                "extracted": False,
                "reason": "unknown_type",
                "message": f"No extraction prompt defined for '{document_type}'.",
            }

        prompt = EXTRACTION_PROMPTS[document_type]

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
            message = await self.client.messages.create(
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
