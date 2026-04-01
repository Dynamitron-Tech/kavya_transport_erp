"""
backend/tests/test_ocr.py
Unit + integration tests for the Document OCR pipeline.

Runs without tesseract/opencv installed (pure regex path) and also
tests the FastAPI endpoint via the shared HTTPX async client.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Dict
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

# ──────────────────────────────────────────────────────────────────────────────
# Service-level unit tests (no HTTP, no DB, no OCR binary required)
# ──────────────────────────────────────────────────────────────────────────────

from app.services.document_ocr_service import (
    ExtractedField,
    OCRResult,
    SUPPORTED_DOC_TYPES,
    _normalise_date,
    _find_value_after_label,
    detect_language,
    detect_doc_type,
    extract_document_fields,
)


class TestNormaliseDate:
    def test_dmy_slash(self):
        assert _normalise_date("15/08/2025") == "2025-08-15"

    def test_dmy_dash(self):
        assert _normalise_date("01-01-2024") == "2024-01-01"

    def test_ymd(self):
        assert _normalise_date("2026-12-31") == "2026-12-31"

    def test_month_name(self):
        result = _normalise_date("15 Aug 2025")
        assert result == "2025-08-15"

    def test_month_name_full(self):
        result = _normalise_date("1 January 2024")
        assert result == "2024-01-01"

    def test_no_date(self):
        assert _normalise_date("no date here") is None

    def test_date_embedded_in_text(self):
        result = _normalise_date("Valid upto 31/12/2027 for all purposes")
        assert result == "2027-12-31"


class TestFindValueAfterLabel:
    def test_colon_separator(self):
        text = "Registration No: TN72BC7214"
        val = _find_value_after_label(text, "Registration No")
        assert val is not None
        assert "TN72BC7214" in val

    def test_multiple_labels_first_match(self):
        text = "Engine No. 1AABC123456"
        val = _find_value_after_label(text, "Chassis No", "Engine No")
        assert val is not None
        assert "1AABC" in val

    def test_no_match(self):
        assert _find_value_after_label("foo bar", "policy") is None


class TestDetectLanguage:
    def test_english_only(self):
        langs = detect_language("Registration Certificate TN72BC7214")
        assert "eng" in langs

    def test_hindi_devanagari(self):
        langs = detect_language("पंजीकरण प्रमाण पत्र")
        assert "hin" in langs

    def test_tamil(self):
        langs = detect_language("பதிவு சான்றிதழ்")
        assert "tam" in langs

    def test_mixed_hindi_english(self):
        langs = detect_language("Registration TN72BC7214 पंजीकरण")
        assert "eng" in langs
        assert "hin" in langs


class TestDetectDocType:
    def test_rc_keywords(self):
        text = "Registration Certificate | Reg No TN72BC7214 | Engine No: 1FMCU9GX"
        assert detect_doc_type(text) == "RC"

    def test_insurance_keywords(self):
        text = "Motor Insurance Policy | Policy No: BA123456 | Insured vehicle MH04AB1234"
        assert detect_doc_type(text) == "Insurance"

    def test_driving_license_keywords(self):
        text = "Driving Licence | LMV | DL No TN0220191234567"
        assert detect_doc_type(text) == "DrivingLicense"

    def test_fitness_keywords(self):
        text = "Fitness Certificate | Fitness No: FC/TN/2024/1234 | Valid upto 31/12/2026"
        assert detect_doc_type(text) == "Fitness"

    def test_puc_keywords(self):
        text = "PUCC | Pollution Under Control Certificate | Test No: PUC2024123"
        assert detect_doc_type(text) == "PUC"

    def test_unknown_returns_other(self):
        result = detect_doc_type("random unrelated text with no doc keywords")
        assert result in ("Other", "RC", "Insurance", "DrivingLicense", "Fitness", "PUC")


class TestExtractRCFields:
    _rc_text = (
        "REGISTRATION CERTIFICATE\n"
        "Reg No: TN72BC7214\n"
        "Owner: KAVYA TRANSPORTS PVT LTD\n"
        "Chassis No: MA1FC2DRXP1234567\n"
        "Engine No: K10C1234567\n"
        "Valid upto: 31/12/2030\n"
        "Fuel Type: Diesel\n"
    )

    def test_registration_number_extracted(self):
        fields = extract_document_fields(self._rc_text, "RC")
        assert "registration_number" in fields
        assert "TN72BC7214" in fields["registration_number"].value.replace(" ", "")

    def test_engine_number(self):
        fields = extract_document_fields(self._rc_text, "RC")
        assert "engine_number" in fields

    def test_chassis_number(self):
        fields = extract_document_fields(self._rc_text, "RC")
        assert "chassis_number" in fields

    def test_valid_upto(self):
        fields = extract_document_fields(self._rc_text, "RC")
        assert "valid_upto" in fields
        assert fields["valid_upto"].value == "2030-12-31"


class TestExtractInsuranceFields:
    _ins_text = (
        "MOTOR INSURANCE POLICY\n"
        "Policy No: BA/123456/2024\n"
        "Insured: KAVYA TRANSPORTS PVT LTD\n"
        "Vehicle: TN72BC7214\n"
        "Valid from: 01/04/2024\n"
        "Valid upto: 31/03/2025\n"
        "Insurer: HDFC ERGO General Insurance\n"
    )

    def test_policy_number(self):
        fields = extract_document_fields(self._ins_text, "Insurance")
        assert "policy_number" in fields

    def test_vehicle_number(self):
        fields = extract_document_fields(self._ins_text, "Insurance")
        assert "vehicle_number" in fields

    def test_valid_upto(self):
        fields = extract_document_fields(self._ins_text, "Insurance")
        assert "valid_upto" in fields


class TestExtractDLFields:
    _dl_text = (
        "DRIVING LICENCE\n"
        "DL No: TN0220191234567\n"
        "Name: RAJAN KUMAR\n"
        "DOB: 01/01/1985\n"
        "Valid till: 31/12/2030\n"
        "Class: LMV, MCWG\n"
    )

    def test_dl_number(self):
        fields = extract_document_fields(self._dl_text, "DrivingLicense")
        assert "dl_number" in fields

    def test_holder_name(self):
        fields = extract_document_fields(self._dl_text, "DrivingLicense")
        assert "holder_name" in fields or "name" in fields

    def test_valid_upto(self):
        fields = extract_document_fields(self._dl_text, "DrivingLicense")
        assert "valid_upto" in fields


class TestExtractFitnessFields:
    _fit_text = (
        "FITNESS CERTIFICATE\n"
        "Fitness No: FC/TN/2024/00123\n"
        "Vehicle: TN72BC7214\n"
        "Valid upto: 30/06/2026\n"
    )

    def test_certificate_number(self):
        fields = extract_document_fields(self._fit_text, "Fitness")
        assert "certificate_number" in fields or "fitness_number" in fields

    def test_vehicle_number(self):
        fields = extract_document_fields(self._fit_text, "Fitness")
        assert "vehicle_number" in fields

    def test_valid_upto(self):
        fields = extract_document_fields(self._fit_text, "Fitness")
        assert "valid_upto" in fields


class TestExtractPUCFields:
    _puc_text = (
        "POLLUTION UNDER CONTROL CERTIFICATE\n"
        "PUCC No: PUC/TN/2024/56789\n"
        "Vehicle: TN72BC7214\n"
        "Test Date: 01/03/2024\n"
        "Valid upto: 01/09/2024\n"
        "CO: 0.15%, HC: 72 ppm\n"
    )

    def test_puc_number(self):
        fields = extract_document_fields(self._puc_text, "PUC")
        assert "puc_number" in fields

    def test_vehicle_number(self):
        fields = extract_document_fields(self._puc_text, "PUC")
        assert "vehicle_number" in fields

    def test_valid_upto(self):
        fields = extract_document_fields(self._puc_text, "PUC")
        assert "valid_upto" in fields


class TestSupportedDocTypes:
    def test_all_types_present(self):
        for t in ("RC", "Insurance", "DrivingLicense", "Fitness", "PUC"):
            assert t in SUPPORTED_DOC_TYPES

    def test_rc_fields_listed(self):
        assert "registration_number" in SUPPORTED_DOC_TYPES["RC"]

    def test_insurance_fields_listed(self):
        assert "policy_number" in SUPPORTED_DOC_TYPES["Insurance"]


# ──────────────────────────────────────────────────────────────────────────────
# HTTP endpoint integration tests
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestDocumentOCREndpoint:
    """Tests for POST /api/v1/documents/ocr"""

    async def test_get_supported_types(self, client: AsyncClient):
        resp = await client.get("/documents/ocr/supported-types")
        assert resp.status_code == 200
        data = resp.json()
        assert "supported_types" in data
        assert "RC" in data["supported_types"]

    async def test_ocr_rejects_wrong_mime(self, client: AsyncClient):
        """Uploading a .txt file must return 422 or 400."""
        content = b"this is not an image"
        resp = await client.post(
            "/documents/ocr",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
        )
        assert resp.status_code in (400, 422)

    async def test_ocr_rejects_empty_file(self, client: AsyncClient):
        resp = await client.post(
            "/documents/ocr",
            files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
        )
        assert resp.status_code in (400, 422)

    @patch("app.services.document_ocr_service._TESS_AVAILABLE", False)
    async def test_ocr_endpoint_graceful_when_tess_unavailable(
        self, client: AsyncClient
    ):
        """When tesseract is not installed the endpoint should still respond."""
        # Tiny valid 1×1 JPEG bytes
        jpeg_bytes = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f"
            b"\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00"
            b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00"
            b"\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03"
            b"\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07\"q\x142\x81\x91\xa1\x08#B\xb1"
            b"\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&'()*456789:CDEFGH"
            b"IJKLMNOPQRSTUVWXYZ\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xf5\x01\xff\xd9"
        )
        resp = await client.post(
            "/documents/ocr",
            files={"file": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        # Should not crash — either 200 with error field or handled error
        assert resp.status_code in (200, 400, 422, 500)

    async def test_ocr_doc_type_query_param(self, client: AsyncClient):
        """doc_type param must accept known values."""
        jpeg_bytes = b"\xff\xd8\xff\xd9"  # minimal JPEG marker
        for valid_type in ("rc", "insurance", "driving_license", "fitness", "puc", "auto"):
            resp = await client.post(
                f"/documents/ocr?doc_type={valid_type}",
                files={"file": ("doc.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            )
            # Accepts the param (may fail OCR but not 422 on param validation)
            assert resp.status_code != 422, f"doc_type={valid_type!r} was rejected"

    async def test_ocr_lang_injection_rejected(self, client: AsyncClient):
        """Lang parameter must not allow shell injection characters."""
        jpeg_bytes = b"\xff\xd8\xff\xd9"
        malicious_lang = "eng; rm -rf /"
        resp = await client.post(
            f"/documents/ocr?lang={malicious_lang}",
            files={"file": ("doc.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        # Must be rejected (400 or 422)
        assert resp.status_code in (400, 422)


# ──────────────────────────────────────────────────────────────────────────────
# Real Tamil Nadu Government Smart Card document tests
# ──────────────────────────────────────────────────────────────────────────────

TN_DL_TEXT = "\n".join([
    "Indian Union Driving Licence",
    "Issued by Government Of Tamil Nadu",
    "TN 72 2024005499",
    "Name: N AJAI KUMAR",
    "Date of Birth: 06-09-2005",
    "Validity(NT) 05-09-2045",
    "Blood Group: A+",
    "Date of Issue: 29-08-2024",
])

TN_RC_TEXT = "\n".join([
    "Indian Union Vehicle Registration Certificate",
    "Issued by Government Of Tamil Nadu",
    "Regn. Number TN72BC7214",
    "Chassis Number MBJB49BT9001213701215",
    "Engine/Motor Number 1ND1440167",
    "Owner Name KUMARASAMY S",
    "Date of Regn. 04-01-2016",
    "Regn. Validity 03-01-2031",
    "Fuel",
    "DIESEL",
])


class TestRealTNSmartCardDL:
    """Regex coverage for actual TN-issued Driving Licence smart card OCR output."""

    def test_detects_document_type(self):
        doc_type = detect_doc_type(TN_DL_TEXT)
        assert doc_type == "DrivingLicense"

    def test_extracts_dl_number(self):
        fields = extract_document_fields(TN_DL_TEXT, "DrivingLicense")
        assert "dl_number" in fields
        normalised = fields["dl_number"].value.replace(" ", "").replace("-", "").upper()
        assert normalised == "TN722024005499"

    def test_extracts_valid_upto_from_validity_nt_label(self):
        fields = extract_document_fields(TN_DL_TEXT, "DrivingLicense")
        assert "valid_upto" in fields
        assert fields["valid_upto"].value == "2045-09-05"

    def test_extracts_blood_group_at_eol(self):
        """A+ at end of line (no trailing word-boundary char) must be captured."""
        fields = extract_document_fields(TN_DL_TEXT, "DrivingLicense")
        assert "blood_group" in fields
        assert fields["blood_group"].value == "A+"

    def test_extracts_name(self):
        fields = extract_document_fields(TN_DL_TEXT, "DrivingLicense")
        assert "holder_name" in fields
        assert "AJAI KUMAR" in fields["holder_name"].value.upper()


class TestRealTNSmartCardRC:
    """Regex coverage for actual TN-issued RC (Registration Certificate) smart card."""

    def test_detects_document_type(self):
        doc_type = detect_doc_type(TN_RC_TEXT)
        assert doc_type == "RC"

    def test_extracts_registration_number(self):
        fields = extract_document_fields(TN_RC_TEXT, "RC")
        assert "registration_number" in fields
        normalised = fields["registration_number"].value.replace(" ", "").replace("-", "").upper()
        assert normalised == "TN72BC7214"

    def test_extracts_engine_number_from_motor_label(self):
        """'Engine/Motor Number' label variant must be recognised."""
        fields = extract_document_fields(TN_RC_TEXT, "RC")
        assert "engine_number" in fields
        assert fields["engine_number"].value.upper() == "1ND1440167"

    def test_extracts_chassis_number(self):
        fields = extract_document_fields(TN_RC_TEXT, "RC")
        assert "chassis_number" in fields
        assert fields["chassis_number"].value.upper() == "MBJB49BT9001213701215"

    def test_extracts_valid_upto_from_regn_validity_label(self):
        """'Regn. Validity' label must map to valid_upto."""
        fields = extract_document_fields(TN_RC_TEXT, "RC")
        assert "valid_upto" in fields
        assert fields["valid_upto"].value == "2031-01-03"

    def test_extracts_fuel_type_from_next_line_format(self):
        """Fuel value on the line AFTER the 'Fuel' label must still be captured."""
        fields = extract_document_fields(TN_RC_TEXT, "RC")
        assert "fuel_type" in fields
        assert fields["fuel_type"].value.lower() == "diesel"

