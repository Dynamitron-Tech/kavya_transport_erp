# tests/test_lr.py — Lorry Receipt CRUD + status tests
import pytest
from httpx import AsyncClient
from datetime import date


async def _create_prerequisites(client: AsyncClient) -> dict:
    """Create a client and job needed before creating an LR."""
    c = await client.post("/clients", json={"name": "LR Test Client"})
    cid = c.json()["data"]["id"]
    j = await client.post("/jobs", json={
        "job_date": str(date.today()),
        "client_id": cid,
        "origin_address": "12 Industrial Estate",
        "origin_city": "Chennai",
        "destination_address": "34 MIDC",
        "destination_city": "Coimbatore",
    })
    return {"client_id": cid, "job_id": j.json()["data"]["id"]}


SAMPLE_LR_TEMPLATE = {
    "lr_date": str(date.today()),
    "consignor_name": "ABC Chemicals",
    "consignee_name": "XYZ Industries",
    "origin": "Chennai",
    "destination": "Coimbatore",
    "freight_amount": 12000,
}


class TestLRCreate:
    async def test_create_lr(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        data = {**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]}
        resp = await client.post("/lr", json=data)
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["lr_number"].startswith("LR")

    async def test_create_lr_with_items(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        data = {
            **SAMPLE_LR_TEMPLATE,
            "job_id": pre["job_id"],
            "items": [
                {"description": "Steel Rods", "packages": 10, "actual_weight": 5000, "rate": 2.5},
                {"description": "Cement Bags", "packages": 50, "actual_weight": 2500},
            ],
        }
        resp = await client.post("/lr", json=data)
        assert resp.status_code == 201

    async def test_create_lr_missing_fields(self, client: AsyncClient):
        resp = await client.post("/lr", json={"lr_date": str(date.today())})
        assert resp.status_code == 422


class TestLRRead:
    async def test_list_lrs_empty(self, client: AsyncClient):
        resp = await client.get("/lr")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_get_lr_by_id(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        create = await client.post("/lr", json={**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]})
        lid = create.json()["data"]["id"]
        resp = await client.get(f"/lr/{lid}")
        assert resp.status_code == 200

    async def test_get_lr_not_found(self, client: AsyncClient):
        resp = await client.get("/lr/99999")
        assert resp.status_code == 404

    async def test_filter_by_job_id(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        await client.post("/lr", json={**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]})
        resp = await client.get("/lr", params={"job_id": pre["job_id"]})
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1


class TestLRUpdate:
    async def test_update_lr(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        create = await client.post("/lr", json={**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]})
        lid = create.json()["data"]["id"]
        resp = await client.put(f"/lr/{lid}", json={"freight_amount": 15000})
        assert resp.status_code == 200

    async def test_update_lr_not_found(self, client: AsyncClient):
        resp = await client.put("/lr/99999", json={"freight_amount": 1})
        assert resp.status_code == 404


class TestLRDelete:
    async def test_delete_lr(self, client: AsyncClient):
        pre = await _create_prerequisites(client)
        create = await client.post("/lr", json={**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]})
        lid = create.json()["data"]["id"]
        resp = await client.delete(f"/lr/{lid}")
        assert resp.status_code == 200

    async def test_delete_lr_not_found(self, client: AsyncClient):
        resp = await client.delete("/lr/99999")
        assert resp.status_code == 404


class TestLRStatus:
    async def _create_lr(self, client: AsyncClient) -> int:
        pre = await _create_prerequisites(client)
        resp = await client.post("/lr", json={**SAMPLE_LR_TEMPLATE, "job_id": pre["job_id"]})
        return resp.json()["data"]["id"]

    async def test_lr_status_lifecycle(self, client: AsyncClient):
        lid = await self._create_lr(client)
        transitions = ["generated", "in_transit", "delivered", "pod_received"]
        for status in transitions:
            resp = await client.post(
                f"/lr/{lid}/status",
                json={"status": status, "remarks": f"Moving to {status}"},
            )
            assert resp.status_code == 200, f"Failed {status}: {resp.text}"

    async def test_lr_invalid_transition(self, client: AsyncClient):
        lid = await self._create_lr(client)
        # draft -> delivered directly should fail
        resp = await client.post(f"/lr/{lid}/status", json={"status": "delivered"})
        assert resp.status_code == 400
