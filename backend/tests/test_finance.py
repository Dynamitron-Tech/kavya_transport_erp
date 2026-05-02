# tests/test_finance.py — Invoice, Payment, Ledger, Vendor tests
import pytest
from httpx import AsyncClient
from datetime import date


async def _create_client(client: AsyncClient) -> int:
    resp = await client.post("/clients", json={
        "name": "Finance Test Corp",
        "gstin": "33AABCU9603R1ZM",
        "state": "Tamil Nadu",
        "gst_state_code": "33",
    })
    return resp.json()["data"]["id"]


class TestInvoiceCreate:
    async def test_create_invoice(self, client: AsyncClient):
        cid = await _create_client(client)
        resp = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Finance Test Corp",
            "billing_gstin": "33AABCU9603R1ZM",
            "billing_state_code": "33",
            "items": [
                {"description": "Chennai-Coimbatore Trip", "rate": 25000, "quantity": 1, "tax_rate": 18},
            ],
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["invoice_number"].startswith("INV")

    async def test_create_invoice_no_items(self, client: AsyncClient):
        cid = await _create_client(client)
        resp = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "No Items Corp",
        })
        # Should succeed (items default to [])
        assert resp.status_code == 201

    async def test_create_invoice_missing_fields(self, client: AsyncClient):
        resp = await client.post("/finance/invoices", json={"invoice_date": str(date.today())})
        assert resp.status_code == 422


class TestInvoiceRead:
    async def test_list_invoices(self, client: AsyncClient):
        resp = await client.get("/finance/invoices")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_get_invoice_by_id(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Read Test Corp",
        })
        iid = create.json()["data"]["id"]
        resp = await client.get(f"/finance/invoices/{iid}")
        assert resp.status_code == 200

    async def test_get_invoice_not_found(self, client: AsyncClient):
        resp = await client.get("/finance/invoices/99999")
        assert resp.status_code == 404


class TestInvoiceUpdate:
    async def test_update_invoice(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Update Test Corp",
        })
        iid = create.json()["data"]["id"]
        resp = await client.put(f"/finance/invoices/{iid}", json={"billing_name": "Updated Corp"})
        assert resp.status_code == 200

    async def test_update_invoice_not_found(self, client: AsyncClient):
        resp = await client.put("/finance/invoices/99999", json={"billing_name": "X"})
        assert resp.status_code == 404


class TestInvoiceDelete:
    async def test_delete_invoice(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Delete Test Corp",
        })
        iid = create.json()["data"]["id"]
        resp = await client.delete(f"/finance/invoices/{iid}")
        assert resp.status_code == 200

    async def test_delete_invoice_not_found(self, client: AsyncClient):
        resp = await client.delete("/finance/invoices/99999")
        assert resp.status_code == 404


class TestPayment:
    async def test_create_payment(self, client: AsyncClient):
        cid = await _create_client(client)
        inv = await client.post("/finance/invoices", json={
            "invoice_date": str(date.today()),
            "due_date": str(date(2025, 12, 31)),
            "client_id": cid,
            "billing_name": "Payment Test Corp",
            "items": [{"description": "Trip Charge", "rate": 30000, "quantity": 1}],
        })
        iid = inv.json()["data"]["id"]
        resp = await client.post("/finance/payments", json={
            "payment_date": str(date.today()),
            "payment_type": "received",
            "invoice_id": iid,
            "client_id": cid,
            "amount": 30000,
            "payment_method": "bank_transfer",
        })
        assert resp.status_code == 201
        assert resp.json()["data"]["payment_number"].startswith("PAY")

    async def test_list_payments(self, client: AsyncClient):
        resp = await client.get("/finance/payments")
        assert resp.status_code == 200


class TestLedger:
    async def test_list_ledger(self, client: AsyncClient):
        resp = await client.get("/finance/ledger")
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestVendor:
    async def test_create_vendor(self, client: AsyncClient):
        resp = await client.post("/finance/vendors", json={
            "name": "Diesel Supplier",
            "code": "VND001",
            "vendor_type": "fuel",
            "gstin": "33AABCU9603R1ZM",
            "phone": "9876543210",
        })
        assert resp.status_code == 201

    async def test_list_vendors(self, client: AsyncClient):
        resp = await client.get("/finance/vendors")
        assert resp.status_code == 200


class TestRoutes:
    async def test_create_route(self, client: AsyncClient):
        resp = await client.post("/finance/routes", json={
            "route_name": "Chennai - Bengaluru",
            "origin_city": "Chennai",
            "origin_state": "Tamil Nadu",
            "destination_city": "Bengaluru",
            "destination_state": "Karnataka",
            "distance_km": 350,
            "estimated_hours": 6,
        })
        assert resp.status_code == 201

    async def test_list_routes(self, client: AsyncClient):
        resp = await client.get("/finance/routes")
        assert resp.status_code == 200

    async def test_get_route_not_found(self, client: AsyncClient):
        resp = await client.get("/finance/routes/99999")
        assert resp.status_code == 404
