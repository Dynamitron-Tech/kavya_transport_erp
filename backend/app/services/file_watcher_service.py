"""
File Watcher Service — IFIAS Phase 1
Monitors OneDrive folders for new freight billing Excel files.

Usage:
    from app.services.file_watcher_service import FileWatcherService
    watcher = FileWatcherService()
    watcher.start()
"""

import logging
import os
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict

from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent
from watchdog.observers import Observer

from app.core.config import settings

# --- Logger setup ---
log_dir = Path(__file__).resolve().parents[3] / "logs"
log_dir.mkdir(exist_ok=True)

file_handler = RotatingFileHandler(
    log_dir / "file_watcher.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
file_handler.setFormatter(
    logging.Formatter("[%(asctime)s] [%(levelname)s] [file_watcher] %(message)s")
)
logger = logging.getLogger("file_watcher")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)


DEBOUNCE_SECONDS = 30
WATCH_PATTERN = getattr(settings, "ONEDRIVE_WATCH_PATTERN", "Invoice Reference")
WATCH_BASE = getattr(settings, "ONEDRIVE_WATCH_PATH", "")


class InvoiceFileHandler(FileSystemEventHandler):
    """Watchdog event handler that filters and dispatches invoice Excel files."""

    def __init__(self):
        super().__init__()
        # Map file_path → last trigger timestamp for debounce
        self._last_trigger: Dict[str, float] = {}

    def _is_invoice_excel(self, path: str) -> bool:
        p = Path(path)
        if p.suffix.lower() not in (".xlsx", ".xls"):
            return False
        # Only process files under "Invoice Reference" folder hierarchy
        if WATCH_PATTERN.lower() not in path.lower():
            return False
        # Skip temp/lock files (Excel creates ~$filename.xlsx during editing)
        if p.name.startswith("~$"):
            return False
        return True

    def _debounce(self, path: str) -> bool:
        """Return True if this event should be processed (not a duplicate)."""
        now = time.monotonic()
        last = self._last_trigger.get(path, 0)
        if now - last < DEBOUNCE_SECONDS:
            logger.debug(f"Debounced: {path}")
            return False
        self._last_trigger[path] = now
        return True

    def _dispatch_task(self, path: str):
        """Fire a Celery task for the detected Excel file."""
        logger.info(f"Detected invoice file: {path}")
        try:
            # Import here to avoid circular import at module load time
            from app.tasks.pipeline_tasks import process_invoice_excel
            result = process_invoice_excel.delay(path)
            logger.info(f"Dispatched task {result.id} for: {path}")
        except Exception as exc:
            logger.error(f"Failed to dispatch task for {path}: {exc}", exc_info=True)

    def on_created(self, event):
        if not event.is_directory and self._is_invoice_excel(event.src_path):
            if self._debounce(event.src_path):
                self._dispatch_task(event.src_path)

    def on_modified(self, event):
        if not event.is_directory and self._is_invoice_excel(event.src_path):
            if self._debounce(event.src_path):
                self._dispatch_task(event.src_path)


class FileWatcherService:
    """
    Service that watches the OneDrive base path for new invoice Excel files.

    Lifecycle:
        watcher = FileWatcherService()
        watcher.start()   # non-blocking, runs observer in background thread
        watcher.stop()    # call on shutdown
    """

    def __init__(self, watch_path: str | None = None):
        self.watch_path = watch_path or WATCH_BASE
        self._observer: Observer | None = None
        self._handler = InvoiceFileHandler()

    def start(self):
        if not self.watch_path:
            logger.warning("ONEDRIVE_WATCH_PATH not configured — file watcher disabled.")
            return

        if not os.path.isdir(self.watch_path):
            logger.warning(f"Watch path does not exist (yet): {self.watch_path}")
            # Don't crash — OneDrive folder may not be present on all environments

        self._observer = Observer()
        self._observer.schedule(self._handler, self.watch_path, recursive=True)
        self._observer.start()
        logger.info(f"File watcher started on: {self.watch_path}")

    def stop(self):
        if self._observer:
            self._observer.stop()
            self._observer.join()
            logger.info("File watcher stopped.")

    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()
