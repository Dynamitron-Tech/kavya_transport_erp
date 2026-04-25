# tests/test_jobs.py — Job CRUD + status transition tests
import pytest
from httpx import AsyncClient
from datetime import date


async def _create_client(client: AsyncClient) -> int:
    resp = await client.post("/clients", json={"name": "Test Transport Co"})
    return resp.json()["data"]["id"]


SAMPLE_JOB = {
    "job_date": str(date.today()),
    "origin_address": "123 Anna Nagar",
    "origin_city": "Chennai",
    "origin_state": "Tamil Nadu",
    "destination_address": "456 MG Road",
    "destination_city": "Bengaluru",
    "destination_state": "Karnataka",
    "material_type": "Steel Coils",
    "agreed_rate": 45000,
}


class TestJobCreate:
    async def test_create_job(self, client: AsyncClient):
        cid = await _create_client(client)
        resp = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] > 0
        assert body["data"]["job_number"].startswith("JOB")

    async def test_create_job_missing_required(self, client: AsyncClient):
        # Missing client_id, origin, destination
        resp = await client.post("/jobs", json={"job_date": str(date.today())})
        assert resp.status_code == 422

    async def test_create_job_invalid_date(self, client: AsyncClient):
        resp = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": 1, "job_date": "not-a-date"})
        assert resp.status_code == 422


class TestJobRead:
    async def test_list_jobs_empty(self, client: AsyncClient):
        resp = await client.get("/jobs")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_list_jobs_with_data(self, client: AsyncClient):
        cid = await _create_client(client)
        await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        resp = await client.get("/jobs")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1

    async def test_get_job_by_id(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        jid = create.json()["data"]["id"]
        resp = await client.get(f"/jobs/{jid}")
        assert resp.status_code == 200

    async def test_get_job_not_found(self, client: AsyncClient):
        resp = await client.get("/jobs/99999")
        assert resp.status_code == 404


class TestJobUpdate:
    async def test_update_job(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        jid = create.json()["data"]["id"]
        resp = await client.put(f"/jobs/{jid}", json={"agreed_rate": 50000})
        assert resp.status_code == 200

    async def test_update_job_not_found(self, client: AsyncClient):
        resp = await client.put("/jobs/99999", json={"agreed_rate": 50000})
        assert resp.status_code == 404


class TestJobDelete:
    async def test_delete_job(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        jid = create.json()["data"]["id"]
        resp = await client.delete(f"/jobs/{jid}")
        assert resp.status_code == 200

    async def test_delete_job_not_found(self, client: AsyncClient):
        resp = await client.delete("/jobs/99999")
        assert resp.status_code == 404


class TestJobStatus:
    async def _create_job(self, client: AsyncClient) -> int:
        cid = await _create_client(client)
        resp = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        return resp.json()["data"]["id"]

    async def test_status_draft_to_pending(self, client: AsyncClient):
        jid = await self._create_job(client)
        resp = await client.post(f"/jobs/{jid}/status", json={"status": "pending_approval"})
        assert resp.status_code == 200

    async def test_status_full_lifecycle(self, client: AsyncClient):
        jid = await self._create_job(client)
        transitions = ["pending_approval", "approved", "in_progress", "completed"]
        for status in transitions:
            resp = await client.post(f"/jobs/{jid}/status", json={"status": status})
            assert resp.status_code == 200, f"Failed transition to {status}: {resp.text}"

    async def test_status_invalid_transition(self, client: AsyncClient):
        jid = await self._create_job(client)
        # draft -> completed directly should fail
        resp = await client.post(f"/jobs/{jid}/status", json={"status": "completed"})
        assert resp.status_code == 400


class TestJobAssign:
    async def test_assign_job(self, client: AsyncClient):
        cid = await _create_client(client)
        create = await client.post("/jobs", json={**SAMPLE_JOB, "client_id": cid})
        jid = create.json()["data"]["id"]
        # Move job to pending_approval first (assign auto-approves then sets in_progress)
        await client.post(f"/jobs/{jid}/status", json={"status": "pending_approval"})
        v = await client.post("/vehicles", json={"registration_number": "TN10AA0001"})
        d = await client.post("/drivers", json={"first_name": "Ravi", "phone": "9876543210"})
        resp = await client.put(
            f"/jobs/{jid}/assign",
            json={"vehicle_id": v.json()["data"]["id"], "driver_id": d.json()["data"]["id"]},
        )
        assert resp.status_code == 200
