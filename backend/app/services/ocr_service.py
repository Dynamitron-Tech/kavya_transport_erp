# Expense OCR Service — Receipt data extraction
# Uses AWS Textract when available, falls back to regex-based text parsing.
# Integrates with expense submission to auto-fill amount, vendor, date.

import re
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)

# Category keyword mapping for auto-classification
CATEGORY_KEYWORDS = {
    "FUEL": ["petrol", "diesel", "fuel", "petroleum", "iocl", "bpcl", "hpcl", "hp", "indian oil", "bharat petroleum", "reliance", "essar", "nayara", "cng", "gas station"],
    "TOLL": ["toll", "nhai", "fastag", "highway", "tollway", "plaza"],
    "FOOD": ["restaurant", "dhaba", "food", "hotel", "canteen", "swiggy", "zomato", "meal", "tea", "coffee", "snack", "biryani", "thali"],
    "PARKING": ["parking", "park", "lot"],
    "REPAIR": ["repair", "mechanic", "garage", "workshop", "service station", "puncture", "tyre", "tire", "spare", "welding"],
    "LOADING": ["loading", "hamali", "labour", "labor", "crane"],
    "UNLOADING": ["unloading", "delivery charge"],
    "POLICE": ["police", "challan", "fine", "rto"],
    "RTO": ["rto", "mvd", "transport office", "permit"],
    "TYRE": ["tyre", "tire", "ceat", "mrf", "apollo", "jk tyre", "bridgestone"],
}


def categorise_expense(text: str) -> Optional[str]:
    """Auto-categorise expense from OCR text content."""
    text_lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return category
    return None


def extract_amount(text: str) -> Optional[Decimal]:
    """Extract the most likely total amount from receipt text."""
    # Look for patterns like "Total: ₹1,234.56" or "TOTAL 1234" or "Grand Total Rs. 500.00"
    patterns = [
        r'(?:total|grand\s*total|amount|net\s*amount|bill\s*amount)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)',
        r'(?:rs\.?|₹|inr)\s*([\d,]+\.?\d*)\s*(?:total|only)',
        r'(?:rs\.?|₹|inr)\s*([\d,]+\.?\d*)',
    ]
    amounts = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            cleaned = m.replace(",", "")
            try:
                val = Decimal(cleaned)
                if val > 0:
                    amounts.append(val)
            except Exception:
                continue

    if not amounts:
        return None
    # Return the largest amount (likely the total)
    return max(amounts)


def extract_date(text: str) -> Optional[datetime]:
    """Extract date from receipt text."""
    date_patterns = [
        (r'(\d{2})[/\-](\d{2})[/\-](\d{4})', "%d/%m/%Y"),  # DD/MM/YYYY
        (r'(\d{2})[/\-](\d{2})[/\-](\d{2})\b', "%d/%m/%y"),  # DD/MM/YY
        (r'(\d{4})[/\-](\d{2})[/\-](\d{2})', "%Y/%m/%d"),  # YYYY-MM-DD
        (r'(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})', None),
    ]
    for pattern, fmt in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                if fmt:
                    date_str = match.group(0).replace("-", "/")
                    return datetime.strptime(date_str, fmt)
                else:
                    # Month name format
                    day = int(match.group(1))
                    month_str = match.group(2)[:3].lower()
                    year = int(match.group(3))
                    months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                              "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
                    month = months.get(month_str, 1)
                    return datetime(year, month, day)
            except (ValueError, KeyError):
                continue
    return None


def extract_vendor(text: str) -> Optional[str]:
    """Extract vendor/merchant name (typically the first non-empty line)."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if lines:
        # First meaningful line is usually the vendor name
        candidate = lines[0][:100]
        if len(candidate) > 2:
            return candidate
    return None


def extract_receipt_number(text: str) -> Optional[str]:
    """Extract receipt/bill/invoice number."""
    patterns = [
        r'(?:receipt|bill|invoice|voucher)\s*(?:no\.?|#|number)\s*[:\-]?\s*([A-Za-z0-9\-/]+)',
        r'(?:no\.?|#)\s*[:\-]?\s*([A-Za-z0-9\-/]{4,20})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


async def extract_text_from_image(image_bytes: bytes) -> str:
    """Extract text from receipt image using AWS Textract or fallback."""
    # Try AWS Textract
    try:
        import boto3
        from app.core.config import settings
        if getattr(settings, "AWS_ACCESS_KEY_ID", None):
            client = boto3.client(
                "textract",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, "AWS_REGION", "ap-south-1"),
            )
            response = client.detect_document_text(
                Document={"Bytes": image_bytes}
            )
            lines = []
            for block in response.get("Blocks", []):
                if block["BlockType"] == "LINE":
                    lines.append(block["Text"])
            text = "\n".join(lines)
            logger.info(f"Textract extracted {len(lines)} lines from receipt")
            return text
    except Exception as e:
        logger.warning(f"Textract unavailable, falling back: {e}")

    # Fallback: return empty (caller handles gracefully)
    logger.info("OCR: No extraction backend available — returning empty text")
    return ""


async def extract_receipt_data(image_bytes: bytes) -> dict:
    """Full OCR pipeline: extract text, then parse amount/date/vendor/category."""
    text = await extract_text_from_image(image_bytes)
    if not text:
        return {"raw_text": "", "extracted": False}

    amount = extract_amount(text)
    date = extract_date(text)
    vendor = extract_vendor(text)
    category = categorise_expense(text)
    receipt_number = extract_receipt_number(text)

    return {
        "raw_text": text[:2000],  # Truncate for storage
        "extracted": True,
        "amount": float(amount) if amount else None,
        "date": date.isoformat() if date else None,
        "vendor": vendor,
        "category": category,
        "receipt_number": receipt_number,
    }
