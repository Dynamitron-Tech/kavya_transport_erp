"""
Email Intelligence Service — IFIAS Phase 2
Connects to Outlook IMAP and searches for Satisfaction Slip emails by LR number.

HOW TO GET AN OUTLOOK APP PASSWORD (required if MFA is enabled on Microsoft 365):
  1. Go to https://account.microsoft.com/security
  2. Click "Advanced security options"
  3. Under "App passwords" → click "Create a new app password"
  4. Copy the generated 16-character password
  5. Set IMAP_PASSWORD=<that password> in backend/.env
  6. NEVER use your normal Outlook login password here

Usage:
    service = EmailIntelligenceService()
    if service.connect():
        result = service.get_best_match("LR-5935/SL-21737")
        if result:
            dl = service.download_attachment(result.message_id, result.folder, "/tmp/slip.pdf")
        service.disconnect()
"""

import email
import imaplib
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from email.header import decode_header
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import List, Optional

from app.core.config import settings

# --- Logger ---
log_dir = Path(__file__).resolve().parents[3] / "logs"
log_dir.mkdir(exist_ok=True)
_fh = RotatingFileHandler(log_dir / "email_search.log", maxBytes=10 * 1024 * 1024, backupCount=5)
_fh.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [email_search] %(message)s"))
logger = logging.getLogger("email_search")
logger.setLevel(logging.INFO)
logger.addHandler(_fh)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class EmailSearchResult:
    message_id: str
    subject: str
    sender: str
    date: datetime
    folder: str
    has_pdf_attachment: bool
    attachment_filename: Optional[str]
    score: int
    lr_found_in: str  # "subject" | "body" | "both" | "none"


@dataclass
class AttachmentDownloadResult:
    success: bool
    local_path: Optional[str]
    s3_key: Optional[str]
    filename: Optional[str]
    error: Optional[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_header_str(raw: str) -> str:
    """Decode MIME-encoded email header."""
    parts = decode_header(raw or "")
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result)


def _extract_lr_numeric_parts(lr_number: str) -> List[str]:
    """
    Extract numeric parts from an LR number for IMAP searching.
    'LR-5935/SL-21737' → ['5935', '21737']
    '4856/72188'       → ['4856', '72188']
    """
    return re.findall(r"\d{4,}", lr_number)


def _parse_email_date(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.utcnow()
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str)
    except Exception:
        return datetime.utcnow()


def _imap_encode_query(text: str) -> str:
    """Encode a search string for IMAP TEXT/SUBJECT/BODY queries."""
    # Must be ASCII; replace non-ASCII chars with ?
    return text.encode("ascii", errors="replace").decode("ascii")


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------

class EmailIntelligenceService:
    """
    Search Outlook IMAP for Satisfaction Slip emails matching LR numbers.
    Maintains a persistent connection with auto-reconnect.
    """

    RETRY_COUNT = 3
    RETRY_BACKOFF = 5  # seconds

    def __init__(self):
        self._imap: Optional[imaplib.IMAP4_SSL] = None
        self._server: str = getattr(settings, "IMAP_SERVER", "imap-mail.outlook.com")
        self._port: int = int(getattr(settings, "IMAP_PORT", 993))
        self._email: str = getattr(settings, "IMAP_EMAIL", "")
        self._password: str = getattr(settings, "IMAP_PASSWORD", "")
        _folders_raw: str = getattr(settings, "IMAP_SEARCH_FOLDERS", "INBOX,Sent Items")
        self._folders: List[str] = [f.strip() for f in _folders_raw.split(",")]

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """Connect and login. Returns True on success."""
        for attempt in range(1, self.RETRY_COUNT + 1):
            try:
                self._imap = imaplib.IMAP4_SSL(self._server, self._port)
                self._imap.login(self._email, self._password)
                logger.info(f"Connected to {self._server} as {self._email}")
                return True
            except imaplib.IMAP4.error as exc:
                logger.error(f"IMAP login failed (attempt {attempt}): {exc}")
            except Exception as exc:
                logger.error(f"IMAP connection error (attempt {attempt}): {exc}")
            if attempt < self.RETRY_COUNT:
                time.sleep(self.RETRY_BACKOFF)
        return False

    def disconnect(self):
        """Logout and close connection."""
        if self._imap:
            try:
                self._imap.logout()
            except Exception:
                pass
            self._imap = None
            logger.info("Disconnected from IMAP.")

    def _ensure_connected(self) -> bool:
        if self._imap is None:
            return self.connect()
        try:
            self._imap.noop()
            return True
        except Exception:
            logger.warning("IMAP connection lost — reconnecting...")
            return self.connect()

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_for_lr(self, lr_number: str) -> List[EmailSearchResult]:
        """
        Search all configured IMAP folders for emails matching an LR number.
        Returns a de-duplicated, score-sorted list of matches (max 5).
        """
        if not self._ensure_connected():
            logger.error(f"[{lr_number}] Cannot search — not connected.")
            return []

        numeric_parts = _extract_lr_numeric_parts(lr_number)
        if not numeric_parts:
            logger.warning(f"[{lr_number}] No numeric parts found — cannot search.")
            return []

        all_results: dict[str, EmailSearchResult] = {}  # msg_id → result

        for folder in self._folders:
            self._search_in_folder(lr_number, numeric_parts, folder, all_results)

        sorted_results = sorted(all_results.values(), key=lambda r: r.score, reverse=True)
        logger.info(
            f"[{lr_number}] Total unique matches: {len(sorted_results)} | "
            f"best score: {sorted_results[0].score if sorted_results else 0}"
        )
        return sorted_results[:5]

    def _search_in_folder(
        self,
        lr_number: str,
        numeric_parts: List[str],
        folder: str,
        results: dict,
    ):
        try:
            status, _ = self._imap.select(f'"{folder}"', readonly=True)
            if status != "OK":
                logger.warning(f"[{lr_number}] Cannot select folder: {folder}")
                return
        except Exception as exc:
            logger.warning(f"[{lr_number}] Folder select error ({folder}): {exc}")
            return

        primary = numeric_parts[0]
        queries = [
            f'SUBJECT "LR Number -{primary}"',
            f'SUBJECT "LR No. {primary}"',
            f'SUBJECT "satisfaction slip"',
            f'BODY "{primary}"',
        ]
        if len(numeric_parts) > 1:
            queries.append(f'BODY "{numeric_parts[1]}"')

        found_uids: set = set()
        for query in queries:
            try:
                encoded_query = _imap_encode_query(query)
                _, data = self._imap.search(None, encoded_query)
                uids = data[0].split() if data and data[0] else []
                logger.info(
                    f"[{lr_number}] folder={folder} query='{query}' hits={len(uids)}"
                )
                found_uids.update(uids)
            except Exception as exc:
                logger.warning(f"[{lr_number}] Search error: {exc}")

        for uid in found_uids:
            try:
                result = self._fetch_and_score_email(uid, folder, lr_number, numeric_parts)
                if result and result.message_id not in results:
                    results[result.message_id] = result
                elif result and result.message_id in results:
                    # Keep higher score
                    if result.score > results[result.message_id].score:
                        results[result.message_id] = result
            except Exception as exc:
                logger.warning(f"[{lr_number}] Failed to fetch UID {uid}: {exc}")

    def _fetch_and_score_email(
        self,
        uid: bytes,
        folder: str,
        lr_number: str,
        numeric_parts: List[str],
    ) -> Optional[EmailSearchResult]:
        _, data = self._imap.fetch(uid, "(RFC822.HEADER BODYSTRUCTURE)")
        if not data or not data[0]:
            return None

        # Parse headers only (faster)
        raw_header = data[0][1] if isinstance(data[0], tuple) else data[0]
        msg = email.message_from_bytes(raw_header)

        subject = _decode_header_str(msg.get("Subject", ""))
        sender = _decode_header_str(msg.get("From", ""))
        date = _parse_email_date(msg.get("Date"))
        message_id = msg.get("Message-ID", uid.decode())

        # Check for PDF attachment in BODYSTRUCTURE
        has_pdf = False
        attach_name = None
        body_struct_raw = b""
        for part in data:
            if isinstance(part, tuple) and len(part) > 1:
                if b"BODYSTRUCTURE" in part[0]:
                    body_struct_raw = part[1]
                    break
        struct_str = body_struct_raw.decode("utf-8", errors="replace").lower()
        if "application/pdf" in struct_str or ".pdf" in struct_str:
            has_pdf = True
            m = re.search(r'"([^"]*\.pdf)"', struct_str, re.IGNORECASE)
            attach_name = m.group(1) if m else "attachment.pdf"

        # Score the email
        score = 0
        lr_in_subject = any(p in subject for p in numeric_parts)
        lr_in_body = False  # body check = expensive, skip unless needed
        for p in numeric_parts:
            if p in subject:
                lr_in_subject = True
        if "satisfaction slip" in subject.lower():
            score += 2
        if has_pdf:
            score += 5
        if lr_in_subject:
            score += 3
        cutoff = datetime.now(tz=date.tzinfo) - timedelta(days=90) if date.tzinfo else datetime.utcnow() - timedelta(days=90)
        if date.replace(tzinfo=None) >= cutoff.replace(tzinfo=None):
            score += 2
        for p in numeric_parts:
            if p in (msg.get("Subject", "") + msg.get("From", "")):
                score += 1

        lr_found_in = "subject" if lr_in_subject else ("body" if lr_in_body else "none")

        return EmailSearchResult(
            message_id=message_id,
            subject=subject,
            sender=sender,
            date=date,
            folder=folder,
            has_pdf_attachment=has_pdf,
            attachment_filename=attach_name,
            score=score,
            lr_found_in=lr_found_in,
        )

    def get_best_match(self, lr_number: str) -> Optional[EmailSearchResult]:
        """Return the highest-scoring email for this LR, or None."""
        results = self.search_for_lr(lr_number)
        return results[0] if results else None

    # ------------------------------------------------------------------
    # Attachment download
    # ------------------------------------------------------------------

    def download_attachment(
        self,
        message_id: str,
        folder: str,
        save_path: str,
    ) -> AttachmentDownloadResult:
        """
        Download the first PDF attachment from a specified email.
        Optionally uploads to S3 if configured.
        """
        if not self._ensure_connected():
            return AttachmentDownloadResult(
                success=False, local_path=None, s3_key=None,
                filename=None, error="Not connected"
            )

        try:
            self._imap.select(f'"{folder}"', readonly=True)
            # Search by message-id
            clean_mid = message_id.strip()
            _, data = self._imap.search(None, f'HEADER "Message-ID" "{_imap_encode_query(clean_mid)}"')
            uids = data[0].split() if data and data[0] else []
            if not uids:
                return AttachmentDownloadResult(
                    success=False, local_path=None, s3_key=None,
                    filename=None, error=f"Message-ID not found in {folder}"
                )

            _, msg_data = self._imap.fetch(uids[0], "(RFC822)")
            raw_msg = msg_data[0][1]
            msg = email.message_from_bytes(raw_msg)

            for part in msg.walk():
                content_type = part.get_content_type()
                filename = part.get_filename()
                if content_type == "application/pdf" or (filename and filename.lower().endswith(".pdf")):
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue

                    os.makedirs(os.path.dirname(save_path), exist_ok=True)
                    with open(save_path, "wb") as f:
                        f.write(payload)

                    logger.info(f"Downloaded attachment to {save_path} ({len(payload)} bytes)")

                    # Upload to S3
                    s3_key = None
                    try:
                        from app.services.s3_service import upload_file
                        import asyncio
                        result = asyncio.run(
                            upload_file(payload, filename or "slip.pdf", folder="satisfaction_slips")
                        )
                        s3_key = result.get("s3_key")
                    except Exception as s3_exc:
                        logger.warning(f"S3 upload skipped: {s3_exc}")

                    return AttachmentDownloadResult(
                        success=True,
                        local_path=save_path,
                        s3_key=s3_key,
                        filename=filename or "slip.pdf",
                        error=None,
                    )

            return AttachmentDownloadResult(
                success=False, local_path=None, s3_key=None,
                filename=None, error="No PDF attachment found in email"
            )

        except Exception as exc:
            logger.error(f"download_attachment error: {exc}", exc_info=True)
            return AttachmentDownloadResult(
                success=False, local_path=None, s3_key=None,
                filename=None, error=str(exc)
            )