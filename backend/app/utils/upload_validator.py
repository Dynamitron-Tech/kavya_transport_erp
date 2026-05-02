"""
Secure file upload validation utilities.

Validates uploaded files by their actual content (magic bytes), NOT by the
client-supplied Content-Type header or filename extension. This prevents
attackers from disguising executables as images/PDFs.

Uses python-magic when libmagic is available; otherwise falls back to a
self-contained magic-byte sniffer covering the formats we accept.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

logger = logging.getLogger(__name__)


# ── MIME → safe extension map (also defines the allow-list) ──────────────────
ALLOWED_IMAGE_DOC_MIMES: dict[str, str] = {
    "application/pdf":   ".pdf",
    "image/jpeg":        ".jpg",
    "image/png":         ".png",
    "image/webp":        ".webp",
    "image/heic":        ".heic",
    "image/heif":        ".heif",
}


# ── Try python-magic first; fall back to built-in sniffer ────────────────────
try:
    import magic as _magic  # type: ignore
    _HAS_LIBMAGIC = True
except Exception:  # pragma: no cover — import error or libmagic missing
    _magic = None  # type: ignore
    _HAS_LIBMAGIC = False


def _sniff_mime_fallback(buf: bytes) -> str | None:
    """Self-contained magic-byte sniffer for the formats we accept."""
    if len(buf) < 12:
        return None
    if buf.startswith(b"%PDF-"):
        return "application/pdf"
    if buf.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if buf.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        return "image/webp"
    if buf[4:8] == b"ftyp" and buf[8:12] in (
        b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1",
    ):
        return "image/heic"
    return None


def _detect_mime(buf: bytes) -> str | None:
    if _HAS_LIBMAGIC and _magic is not None:
        try:
            return _magic.from_buffer(buf, mime=True)
        except Exception as exc:  # pragma: no cover
            logger.warning("[upload] python-magic failed, falling back: %s", exc)
    return _sniff_mime_fallback(buf)


async def validate_upload(
    file: UploadFile,
    *,
    allowed_mimes: dict[str, str] = ALLOWED_IMAGE_DOC_MIMES,
    max_bytes: int = 10 * 1024 * 1024,
) -> tuple[bytes, str, str]:
    """
    Read, validate, and rename an uploaded file.

    Returns:
        (file_bytes, detected_mime, safe_filename)

    Raises HTTPException 400 on:
        - oversized payload
        - unrecognised content (magic bytes don't match any allowed type)
        - mismatch between detected MIME and allowed list
    """
    file_bytes = await file.read()

    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB.",
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    detected = _detect_mime(file_bytes)
    if detected not in allowed_mimes:
        allowed_pretty = ", ".join(sorted({m.split("/")[-1].upper() for m in allowed_mimes}))
        raise HTTPException(
            status_code=400,
            detail=(
                f"File content type '{detected or 'unknown'}' is not allowed. "
                f"Allowed types: {allowed_pretty}."
            ),
        )

    # Generate safe filename — never trust the original
    safe_filename = f"{uuid.uuid4().hex}{allowed_mimes[detected]}"
    return file_bytes, detected, safe_filename


def safe_original_name(original: str | None) -> str:
    """Return a sanitized version of the user-supplied filename for display only."""
    if not original:
        return "upload"
    base = Path(original).name  # strips any path traversal
    # Limit length, keep alnum + a few safe chars
    cleaned = "".join(c for c in base if c.isalnum() or c in "._-")[:120]
    return cleaned or "upload"
