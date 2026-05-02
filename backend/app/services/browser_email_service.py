"""
Browser Email Service — IFIAS Hybrid Fallback

Uses Playwright (headless Chromium) to log into Outlook Web and search for
Satisfaction Slip emails by LR number when IMAP is blocked or unavailable.

Supported Outlook environments:
    - outlook.office.com   (Microsoft 365 / work accounts) [default]
    - outlook.live.com     (personal Microsoft accounts)

Required ENV (browser fallback):
    OUTLOOK_EMAIL      = your.email@company.com
    OUTLOOK_PASSWORD   = your_password (or app password if MFA enabled)

Optional ENV:
    OUTLOOK_WEB_URL    = https://outlook.office.com  (override default)

Setup (once):
    pip install playwright
    playwright install chromium

HOW IT WORKS:
    1. Launch headless Chromium, navigate to Outlook Web
    2. Complete Microsoft login flow
    3. For each LR: search → find email with PDF attachment → download → return path
    4. Session is reused across all LRs in the batch (login once)
    5. On session expiry: automatic re-login once before giving up
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration from ENV
# ---------------------------------------------------------------------------

OUTLOOK_EMAIL    = os.getenv("OUTLOOK_EMAIL", "")
OUTLOOK_PASSWORD = os.getenv("OUTLOOK_PASSWORD", "")
OUTLOOK_WEB_URL  = os.getenv("OUTLOOK_WEB_URL", "https://outlook.office.com")

# Timeout constants (milliseconds)
_NAV_TIMEOUT    = 30_000   # page navigation
_WAIT_TIMEOUT   = 20_000   # wait for selector
_ACTION_TIMEOUT = 15_000   # UI interaction
_DOWNLOAD_TIMEOUT = 30_000  # file download


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class BrowserEmailService:
    """
    Playwright-based Outlook Web email search with PDF download.

    Keeps browser session alive between LR searches — login once per batch.

    Usage:
        svc = BrowserEmailService()
        if svc.connect():
            pdf_path = svc.get_pdf_for_lr("LR-5935/SL-21737")
            svc.disconnect()
    """

    def __init__(self):
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._logged_in = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """
        Launch headless browser, open Outlook Web, and log in.

        Returns:
            True  — login succeeded, ready to search
            False — credentials missing / playwright not installed / login failed
        """
        if not OUTLOOK_EMAIL or not OUTLOOK_PASSWORD:
            logger.info("[Browser] OUTLOOK_EMAIL/OUTLOOK_PASSWORD not set — browser fallback disabled")
            return False

        try:
            from playwright.sync_api import sync_playwright  # deferred import — optional dependency

            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            self._context = self._browser.new_context(
                accept_downloads=True,
                viewport={"width": 1280, "height": 800},
                # Realistic user-agent reduces bot detection
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
            )
            self._page = self._context.new_page()

            success = self._login()
            if success:
                logger.info("[Browser] Outlook Web login successful")
            return success

        except ImportError:
            logger.warning(
                "[Browser] playwright not installed — browser fallback disabled. "
                "Install with: pip install playwright && playwright install chromium"
            )
            self._cleanup()
            return False

        except Exception as exc:
            logger.warning(f"[Browser] connect() failed: {exc}")
            self._cleanup()
            return False

    def disconnect(self) -> None:
        """Close browser and release all resources."""
        self._cleanup()

    def get_pdf_for_lr(self, lr_number: str) -> Optional[str]:
        """
        Search Outlook Web for the most recent email mentioning lr_number
        that has a PDF attachment. Downloads the PDF to a temp file.

        Returns:
            Absolute path to the downloaded PDF, or None if not found.

        Never raises — failures are logged and None is returned.
        """
        if not self._logged_in or not self._page:
            return None

        try:
            result = self._search_and_download(lr_number)
            if result:
                logger.info(f"[Browser][{lr_number}] PDF downloaded: {result}")
            return result

        except Exception as exc:
            logger.warning(f"[Browser][{lr_number}] Search failed: {exc} — attempting re-login")
            # Attempt re-login once (session may have expired)
            try:
                if self._login():
                    return self._search_and_download(lr_number)
            except Exception as exc2:
                logger.warning(f"[Browser][{lr_number}] Re-login also failed: {exc2}")
            return None

    # ------------------------------------------------------------------
    # Internal: login
    # ------------------------------------------------------------------

    def _login(self) -> bool:
        """
        Navigate to Outlook Web and complete Microsoft login flow.
        Handles both work/school (office.com) and personal (live.com) accounts.
        """
        self._logged_in = False
        try:
            page = self._page

            # Navigate to Outlook — this redirects to Microsoft login
            page.goto(OUTLOOK_WEB_URL, timeout=_NAV_TIMEOUT, wait_until="domcontentloaded")

            # --- Step 1: Enter email ---
            page.wait_for_selector('input[type="email"], input[name="loginfmt"]', timeout=_WAIT_TIMEOUT)
            page.fill('input[type="email"], input[name="loginfmt"]', OUTLOOK_EMAIL)

            # Click Next (submit email)
            next_btn = page.query_selector('input[type="submit"][value="Next"], input[id="idSIButton9"]')
            if next_btn:
                next_btn.click()
            else:
                page.keyboard.press("Enter")

            # --- Step 2: Enter password ---
            page.wait_for_selector('input[type="password"], input[name="passwd"]', timeout=_WAIT_TIMEOUT)
            page.fill('input[type="password"], input[name="passwd"]', OUTLOOK_PASSWORD)

            # Click Sign In
            signin_btn = page.query_selector(
                'input[type="submit"][value="Sign in"], '
                'input[id="idSIButton9"], '
                'button[type="submit"]'
            )
            if signin_btn:
                signin_btn.click()
            else:
                page.keyboard.press("Enter")

            # --- Step 3: Handle "Stay signed in?" prompt (optional) ---
            try:
                stay_btn = page.wait_for_selector(
                    'input[value="No"], #idBtn_Back, input[id="idBtn_Back"]',
                    timeout=6_000,
                )
                if stay_btn:
                    stay_btn.click()
            except Exception:
                pass  # Prompt may not appear — proceed

            # --- Step 4: Verify Outlook inbox loaded ---
            page.wait_for_selector(
                '[aria-label="Search"], '
                '[placeholder*="Search"], '
                '[role="search"], '
                '[aria-label*="Search Mail"]',
                timeout=_WAIT_TIMEOUT,
            )

            self._logged_in = True
            return True

        except Exception as exc:
            logger.warning(f"[Browser] _login() failed: {exc}")
            return False

    # ------------------------------------------------------------------
    # Internal: search + download
    # ------------------------------------------------------------------

    def _search_and_download(self, lr_number: str) -> Optional[str]:
        """
        Use Outlook Web search to find the most recent email mentioning
        lr_number that has a PDF attachment.

        Returns path to downloaded PDF, or None.
        """
        page = self._page

        # --- Focus the search box ---
        search_selectors = [
            '[aria-label="Search Mail"]',
            '[aria-label="Search"]',
            'input[placeholder*="Search"]',
            '[role="search"] input',
        ]
        search_box = None
        for sel in search_selectors:
            try:
                search_box = page.wait_for_selector(sel, timeout=5_000)
                if search_box:
                    break
            except Exception:
                continue

        if not search_box:
            logger.warning(f"[Browser][{lr_number}] Search box not found — session may have changed")
            return None

        # --- Type the LR number and submit ---
        search_box.click()
        search_box.fill("")
        search_box.type(lr_number, delay=50)  # natural typing speed
        page.keyboard.press("Enter")

        # --- Wait for search result list ---
        result_selectors = [
            '[role="listbox"] [role="option"]',
            '[role="list"] [role="listitem"]',
            '.ms-List-cell',
            '[data-list-index]',
        ]
        results_found = False
        for sel in result_selectors:
            try:
                page.wait_for_selector(sel, timeout=_WAIT_TIMEOUT)
                results_found = True
                break
            except Exception:
                continue

        if not results_found:
            logger.info(f"[Browser][{lr_number}] No search results returned")
            return None

        # --- Iterate first 5 results looking for PDF attachment ---
        email_items = []
        for sel in result_selectors:
            email_items = page.query_selector_all(sel)
            if email_items:
                break

        for item in email_items[:5]:
            try:
                item.click()

                # Wait for the reading pane / message panel to load
                page.wait_for_selector(
                    '[role="region"][aria-label*="message"], '
                    '.allowTextSelection, '
                    '[data-app-section="ConversationContainer"], '
                    '[aria-label*="Message body"]',
                    timeout=_ACTION_TIMEOUT,
                )

                # --- Look for a PDF attachment ---
                attachment = self._find_pdf_attachment(page)
                if not attachment:
                    continue

                # --- Download the PDF ---
                tmp_dir = tempfile.mkdtemp(prefix="ifias_browser_")
                safe_lr = lr_number.replace("/", "_").replace(" ", "_")
                expected_path = os.path.join(tmp_dir, f"slip_{safe_lr}.pdf")

                with page.expect_download(timeout=_DOWNLOAD_TIMEOUT) as dl_info:
                    attachment.click()

                download = dl_info.value
                download.save_as(expected_path)

                if os.path.exists(expected_path) and os.path.getsize(expected_path) > 100:
                    return expected_path

                logger.warning(f"[Browser][{lr_number}] Downloaded file is empty or missing")

            except Exception as exc:
                logger.debug(f"[Browser][{lr_number}] Error checking email item: {exc}")
                continue

        return None

    @staticmethod
    def _find_pdf_attachment(page) -> Optional[object]:
        """
        Look for a PDF attachment element in the currently open email.
        Returns the clickable element or None.
        """
        attachment_selectors = [
            '[aria-label$=".pdf"]',
            '[title$=".pdf"]',
            'span[title*=".pdf"]',
            'button[aria-label*=".pdf"]',
            '[data-icon-name="AttachFile"] ~ span',
            'span.ms-Button-label[title*=".pdf"]',
        ]
        for sel in attachment_selectors:
            try:
                el = page.query_selector(sel)
                if el:
                    return el
            except Exception:
                continue
        return None

    # ------------------------------------------------------------------
    # Internal: cleanup
    # ------------------------------------------------------------------

    def _cleanup(self) -> None:
        """Release playwright resources gracefully."""
        for obj, attr in [
            (self._context, "close"),
            (self._browser, "close"),
            (self._playwright, "stop"),
        ]:
            if obj:
                try:
                    getattr(obj, attr)()
                except Exception:
                    pass
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._logged_in = False
