# Number Generation Utility
import random
import string
from datetime import datetime


def generate_number(prefix: str, length: int = 6) -> str:
    """Generate a unique number with prefix and timestamp component."""
    ts = datetime.utcnow().strftime("%y%m%d")
    rand = ''.join(random.choices(string.digits, k=length))
    return f"{prefix}-{ts}-{rand}"


def generate_job_number() -> str:
    return generate_number("JOB", 4)


def generate_lr_number() -> str:
    return generate_number("LR", 4)


def generate_trip_number() -> str:
    return generate_number("TRP", 4)


def generate_invoice_number() -> str:
    return generate_number("INV", 4)


def generate_payment_number() -> str:
    return generate_number("PAY", 4)


def generate_ledger_number() -> str:
    return generate_number("LED", 4)


def generate_route_code(origin: str, dest: str) -> str:
    o = origin[:3].upper()
    d = dest[:3].upper()
    rand = ''.join(random.choices(string.digits, k=3))
    return f"RT-{o}-{d}-{rand}"


def generate_client_code(name: str) -> str:
    prefix = ''.join(c for c in name[:4].upper() if c.isalpha())
    rand = ''.join(random.choices(string.digits, k=3))
    return f"CL-{prefix}-{rand}"
