# tests/test_payments.py — Unit tests for UPI / NEFT / RTGS / Cheque / Cash
# payment recording (receivable payments feature).
#
# Coverage:
#   1. test_record_payment_upi_success
#   2. test_record_payment_overpayment_rejected       → 422
#   3. test_record_payment_duplicate_ref_rejected     → 422
#   4. test_record_payment_already_paid_invoice_rejected → 422
#   5. test_invoice_status_partial_after_part_payment
#   6. test_invoice_status_paid_after_full_payment
#   7. test_get_client_payment_info_no_upi
#
# All tests use the in-memory SQLite test client from conftest.py.

import pytest
from datetime import date
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ─────────────────────────────────────────────────────────────────────────────
# Seed helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _seed_client(client: AsyncClient, *, upi_id: str | None = None) -> int:
    """Create a client and return its id."""
    payload = {
        "name": "Kavya Test Client",
        "code": f"KTC{date.today().isoformat().replace('-', '')}",
        "gstin": "33AABCU9603R1ZM",
        "state": "Tamil Nadu",
        "gst_state_code": "33",
    }
    resp = await client.post("/clients", json=payload)
    assert resp.status_code in (200, 201), resp.text
    client_id: int = resp.json()["data"]["id"]

    if upi_id:
        # PATCH upi_id — the clients PATCH endpoint accepts partial updates
        await client.patch(f"/clients/{client_id}", json={"upi_id": upi_id})

    return client_id


async def _seed_invoice(
    client: AsyncClient,
    *,
    client_id: int,
    total: float = 50000,
) -> tuple[int, str]:
    """Create an invoice and return (invoice_id, invoice_number)."""
    resp = await client.post(
        "/finance/invoices",
        json={
            "invoice_date": str(date.today()),
            "due_date": str(date.today()),
            "client_id": client_id,
            "billing_name": "Kavya Test Client",
            "items": [
                {
                    "description": "Freight charges",
                    "rate": total,
                    "quantity": 1,
                    "tax_rate": 0,
                }
            ],
        },
    )
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()["data"]
    return data["id"], data["invoice_number"]


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — UPI payment success
# ─────────────────────────────────────────────────────────────────────────────

async def test_record_payment_upi_success(client: AsyncClient):
    cid = await _seed_client(client, upi_id="9876543210@okaxis")
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=25000)

    resp = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 25000,
            "payment_mode": "UPI",
            "reference_number": "T260321001234",
            "upi_txn_id": "T260321GPAY9X1",
            "payment_date": str(date.today()),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["new_status"] == "PAID"
    assert body["data"]["outstanding_balance"] == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — Overpayment rejected with 422
# ─────────────────────────────────────────────────────────────────────────────

async def test_record_payment_overpayment_rejected(client: AsyncClient):
    cid = await _seed_client(client)
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=10000)

    resp = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 99999,
            "payment_mode": "CASH",
            "payment_date": str(date.today()),
        },
    )
    assert resp.status_code == 422
    assert "exceeds" in resp.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — Duplicate reference number on the same invoice rejected
# ─────────────────────────────────────────────────────────────────────────────

async def test_record_payment_duplicate_ref_rejected(client: AsyncClient):
    cid = await _seed_client(client)
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=40000)

    first = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 10000,
            "payment_mode": "NEFT",
            "reference_number": "UTRUSDT12345",
            "payment_date": str(date.today()),
        },
    )
    assert first.status_code == 200, first.text

    second = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 10000,
            "payment_mode": "NEFT",
            "reference_number": "UTRUSDT12345",   # same ref
            "payment_date": str(date.today()),
        },
    )
    assert second.status_code == 422
    assert "already recorded" in second.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — Recording against a fully-paid invoice is rejected
# ─────────────────────────────────────────────────────────────────────────────

async def test_record_payment_already_paid_invoice_rejected(client: AsyncClient):
    cid = await _seed_client(client)
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=5000)

    # Pay in full
    await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 5000,
            "payment_mode": "CASH",
            "payment_date": str(date.today()),
        },
    )

    # Try to pay again
    resp = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 1000,
            "payment_mode": "CASH",
            "payment_date": str(date.today()),
        },
    )
    assert resp.status_code == 422
    assert "already" in resp.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — Partial payment sets status to PARTIAL
# ─────────────────────────────────────────────────────────────────────────────

async def test_invoice_status_partial_after_part_payment(client: AsyncClient):
    cid = await _seed_client(client)
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=20000)

    resp = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 7500,
            "payment_mode": "RTGS",
            "reference_number": "RTGSPARTIAL001",
            "payment_date": str(date.today()),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["data"]["new_status"] == "PARTIAL"
    assert body["data"]["outstanding_balance"] == 12500.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 6 — Full payment sets status to PAID
# ─────────────────────────────────────────────────────────────────────────────

async def test_invoice_status_paid_after_full_payment(client: AsyncClient):
    cid = await _seed_client(client)
    inv_id, _ = await _seed_invoice(client, client_id=cid, total=15000)

    resp = await client.post(
        "/receivables/record-payment",
        json={
            "invoice_id": inv_id,
            "amount_paid": 15000,
            "payment_mode": "CHEQUE",
            "reference_number": "CHQ00123456",
            "payment_date": str(date.today()),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["data"]["new_status"] == "PAID"
    assert float(body["data"]["outstanding_balance"]) == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 7 — Client with no UPI info returns upi_available: false
# ─────────────────────────────────────────────────────────────────────────────

async def test_get_client_payment_info_no_upi(client: AsyncClient):
    cid = await _seed_client(client)  # no upi_id

    resp = await client.get(f"/clients/{cid}/payment-info")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["upi_available"] is False
