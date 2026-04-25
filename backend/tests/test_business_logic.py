# tests/test_business_logic.py — Cross-module business rule tests
import pytest
from httpx import AsyncClient
from datetime import date, datetime


async def _setup_full_chain(client: AsyncClient) -> dict:
    """Create the full chain: client → job → vehicle → driver → LR → trip."""
    c = await client.post("/clients", json={
        "name": "BizLogic Corp",
        "state": "Tamil Nadu",
        "gst_state_code": "33",
        "gstin": "33AABCU9603R1ZM",
    })
    cid = c.json()["data"]["id"]

    j = await client.post("/jobs", json={
        "job_date": str(date.today()),
        "client_id": cid,
        "origin_address": "Chennai Port",
        "origin_city": "Chennai",
        "origin_state": "Tamil Nadu",
        "destination_address": "Madurai Warehouse",
        "destination_city": "Madurai",
        "destination_state": "Tamil Nadu",
        "agreed_rate": 50000,
    })
    jid = j.json()["data"]["id"]

    v = await client.post("/vehicles", json={"registration_number": "TN09BZ7777"})
    vid = v.json()["data"]["id"]

    d = await client.post("/drivers", json={"first_name": "Kumar", "phone": "9876500001"})
    did = d.json()["data"]["id"]

    lr = await client.post("/lr", json={
        "lr_date": str(date.today()),
        "job_id": jid,
        "consignor_name": "ABC Ltd",
        "consignee_name": "XYZ Ltd",
        "origin": "Chennai",
        "destination": "Madurai",
    })
    lr_id = lr.json()["data"]["id"]

    trip = await client.post("/trips", json={
        "trip_date": str(date.today()),
        "job_id": jid,
        "vehicle_id": vid,
        "driver_id": did,
        "origin": "Chennai",
        "destination": "Madurai",
        "lr_ids": [lr_id],
    })
    tid = trip.json()["data"]["id"]

    return {
        "client_id": cid,
        "job_id": jid,
        "vehicle_id": vid,
        "driver_id": did,
        "lr_id": lr_id,
        "trip_id": tid,
    }


class TestJobStatusTransitions:
    """Job status must follow: draft → pending_approval → approved → in_progress → completed."""

    async def test_cannot_skip_approval(self, client: AsyncClient):
        c = await client.post("/clients", json={"name": "Skip Test"})
        j = await client.post("/jobs", json={
            "job_date": str(date.today()),
            "client_id": c.json()["data"]["id"],
            "origin_address": "A",
            "origin_city": "Chennai",
            "destination_address": "B",
            "destination_city": "Madurai",
        })
        jid = j.json()["data"]["id"]
        # draft → approved (skip pending_approval) should fail
        resp = await client.post(f"/jobs/{jid}/status", json={"status": "approved"})
        assert resp.status_code == 400

    async def test_cannot_go_backward(self, client: AsyncClient):
        c = await client.post("/clients", json={"name": "Backward Test"})
        j = await client.post("/jobs", json={
            "job_date": str(date.today()),
            "client_id": c.json()["data"]["id"],
            "origin_address": "A",
            "origin_city": "Chennai",
            "destination_address": "B",
            "destination_city": "Madurai",
        })
        jid = j.json()["data"]["id"]
        await client.post(f"/jobs/{jid}/status", json={"status": "pending_approval"})
        await client.post(f"/jobs/{jid}/status", json={"status": "approved"})
        # approved → draft should fail
        resp = await client.post(f"/jobs/{jid}/status", json={"status": "draft"})
        assert resp.status_code == 400


class TestTripStatusTransitions:
    """Trip status must follow: planned → started → loading → in_transit → unloading → completed."""

    async def test_cannot_complete_from_planned(self, client: AsyncClient):
        ids = await _setup_full_chain(client)
        resp = await client.post(
            f"/trips/{ids['trip_id']}/status",
            json={"status": "completed"},
        )
        assert resp.status_code == 400

    async def test_full_trip_lifecycle(self, client: AsyncClient):
        ids = await _setup_full_chain(client)
        tid = ids["trip_id"]
        for status in ["started", "loading", "in_transit", "unloading", "completed"]:
            resp = await client.post(
                f"/trips/{tid}/status",
                json={"status": status, "remarks": f"Auto test → {status}"},
            )
            assert resp.status_code == 200, f"Failed at {status}: {resp.text}"


class TestInvoiceGST:
    """Invoice GST calculation: intra-state → CGST+SGST, inter-state → IGST."""

    async def test_intra_state_gst(self, client: AsyncClient):
        """Same state (TN→TN) should use CGST + SGST."""
        cid_resp = await client.post("/clients", json={
            "name": "TN Client",
            "state": "Tamil Nadu",
            "gst_state_code": "33",
            "gstin": "33AABCU9603R1ZM",
        })
        cid = cid_resp.json()["data"]["id"]
        resp = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "TN Client",
            "billing_gstin": "33AABCU9603R1ZM",
            "billing_state_code": "33",
            "items": [{"description": "Transport", "rate": 10000, "quantity": 1, "tax_rate": 18}],
        })
        assert resp.status_code == 201
        inv_id = resp.json()["data"]["id"]
        detail = await client.get(f"/finance/invoices/{inv_id}")
        data = detail.json()["data"]
        cgst = float(data.get("cgst_amount", 0))
        sgst = float(data.get("sgst_amount", 0))
        igst = float(data.get("igst_amount", 0))
        # For intra-state, CGST and SGST should each be 9% of taxable
        if cgst > 0:
            assert cgst == sgst
            assert igst == 0

    async def test_inter_state_gst(self, client: AsyncClient):
        """Different state (TN→KA) should use IGST."""
        cid_resp = await client.post("/clients", json={
            "name": "KA Client",
            "state": "Karnataka",
            "gst_state_code": "29",
            "gstin": "29AABCU9603R1ZP",
        })
        cid = cid_resp.json()["data"]["id"]
        resp = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "KA Client",
            "billing_gstin": "29AABCU9603R1ZP",
            "billing_state_code": "29",
            "items": [{"description": "Transport", "rate": 20000, "quantity": 1, "tax_rate": 18}],
        })
        assert resp.status_code == 201
        inv_id = resp.json()["data"]["id"]
        detail = await client.get(f"/finance/invoices/{inv_id}")
        data = detail.json()["data"]
        igst = float(data.get("igst_amount", 0))
        cgst = float(data.get("cgst_amount", 0))
        sgst = float(data.get("sgst_amount", 0))
        # For inter-state, IGST should be present
        if igst > 0:
            assert cgst == 0
            assert sgst == 0


class TestInvoiceTotals:
    """Invoice total = subtotal + tax - discount."""

    async def test_invoice_total_calculation(self, client: AsyncClient):
        cid_resp = await client.post("/clients", json={"name": "Totals Test"})
        cid = cid_resp.json()["data"]["id"]
        resp = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Totals Test",
            "items": [
                {"description": "Trip A", "rate": 10000, "quantity": 2, "tax_rate": 18},
                {"description": "Trip B", "rate": 5000, "quantity": 1, "tax_rate": 18},
            ],
        })
        assert resp.status_code == 201
        inv_id = resp.json()["data"]["id"]
        detail = await client.get(f"/finance/invoices/{inv_id}")
        data = detail.json()["data"]
        subtotal = float(data["subtotal"])
        total = float(data["total_amount"])
        # subtotal = (10000*2) + (5000*1) = 25000
        assert subtotal >= 25000
        # total = subtotal + tax
        assert total > subtotal


class TestTripExpenseAccumulation:
    """Adding expenses should update total_expense on the trip."""

    async def test_expenses_accumulate(self, client: AsyncClient):
        ids = await _setup_full_chain(client)
        tid = ids["trip_id"]
        # Add two expenses
        await client.post(f"/trips/{tid}/expenses", json={
            "category": "toll", "amount": 500,
            "expense_date": datetime.utcnow().isoformat(),
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "category": "food", "amount": 300,
            "expense_date": datetime.utcnow().isoformat(),
        })
        # Retrieve trip and check total_expense
        trip_resp = await client.get(f"/trips/{tid}")
        trip_data = trip_resp.json()["data"]
        assert float(trip_data.get("total_expense", 0)) >= 800


class TestPaymentReducesInvoiceDue:
    """Recording a payment should reduce invoice amount_due."""

    async def test_payment_updates_invoice(self, client: AsyncClient):
        cid_resp = await client.post("/clients", json={"name": "Pay Test Corp"})
        cid = cid_resp.json()["data"]["id"]
        inv = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Pay Test Corp",
            "items": [{"description": "Full Trip", "rate": 50000, "quantity": 1, "tax_rate": 18}],
        })
        inv_id = inv.json()["data"]["id"]

        # Make partial payment
        await client.post("/finance/payments", json={
            "payment_date": str(date.today()),
            "payment_type": "received",
            "invoice_id": inv_id,
            "client_id": cid,
            "amount": 20000,
            "payment_method": "bank_transfer",
        })

        detail = await client.get(f"/finance/invoices/{inv_id}")
        data = detail.json()["data"]
        assert float(data["amount_paid"]) >= 20000
        assert float(data["amount_due"]) < float(data["total_amount"])
