# tests/test_clients.py — Client CRUD tests
import pytest
from httpx import AsyncClient


SAMPLE_CLIENT = {
    "name": "Kavya Logistics Pvt Ltd",
    "client_type": "premium",
    "email": "info@kavya.com",
    "phone": "9876543210",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "gstin": "33AABCU9603R1ZM",
}


class TestClientCreate:
    async def test_create_client(self, client: AsyncClient):
        resp = await client.post("/clients", json=SAMPLE_CLIENT)
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] > 0

    async def test_create_client_minimal(self, client: AsyncClient):
        resp = await client.post("/clients", json={"name": "Minimal Client"})
        assert resp.status_code == 201

    async def test_create_client_missing_name(self, client: AsyncClient):
        resp = await client.post("/clients", json={"city": "Chennai"})
        assert resp.status_code == 422

    async def test_create_client_empty_name(self, client: AsyncClient):
        resp = await client.post("/clients", json={"name": ""})
        assert resp.status_code == 422


class TestClientRead:
    async def test_list_clients_empty(self, client: AsyncClient):
        resp = await client.get("/clients")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["pagination"]["total"] == 0

    async def test_list_clients_with_data(self, client: AsyncClient):
        await client.post("/clients", json=SAMPLE_CLIENT)
        resp = await client.get("/clients")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1

    async def test_get_client_by_id(self, client: AsyncClient):
        create = await client.post("/clients", json=SAMPLE_CLIENT)
        cid = create.json()["data"]["id"]
        resp = await client.get(f"/clients/{cid}")
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == SAMPLE_CLIENT["name"]

    async def test_get_client_not_found(self, client: AsyncClient):
        resp = await client.get("/clients/99999")
        assert resp.status_code == 404

    async def test_list_clients_search(self, client: AsyncClient):
        await client.post("/clients", json=SAMPLE_CLIENT)
        resp = await client.get("/clients", params={"search": "Kavya"})
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1


class TestClientUpdate:
    async def test_update_client(self, client: AsyncClient):
        create = await client.post("/clients", json=SAMPLE_CLIENT)
        cid = create.json()["data"]["id"]
        resp = await client.put(f"/clients/{cid}", json={"city": "Coimbatore"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_update_client_not_found(self, client: AsyncClient):
        resp = await client.put("/clients/99999", json={"city": "Madurai"})
        assert resp.status_code == 404


class TestClientDelete:
    async def test_delete_client(self, client: AsyncClient):
        create = await client.post("/clients", json=SAMPLE_CLIENT)
        cid = create.json()["data"]["id"]
        resp = await client.delete(f"/clients/{cid}")
        assert resp.status_code == 200
        # Verify it's gone (soft delete)
        resp2 = await client.get(f"/clients/{cid}")
        assert resp2.status_code == 404

    async def test_delete_client_not_found(self, client: AsyncClient):
        resp = await client.delete("/clients/99999")
        assert resp.status_code == 404


class TestClientContacts:
    async def test_add_contact(self, client: AsyncClient):
        create = await client.post("/clients", json=SAMPLE_CLIENT)
        cid = create.json()["data"]["id"]
        resp = await client.post(
            f"/clients/{cid}/contacts",
            json={"name": "Ravi Kumar", "phone": "9988776655", "is_primary": True},
        )
        assert resp.status_code in (200, 201)

    async def test_list_contacts(self, client: AsyncClient):
        create = await client.post("/clients", json=SAMPLE_CLIENT)
        cid = create.json()["data"]["id"]
        await client.post(f"/clients/{cid}/contacts", json={"name": "Ravi"})
        resp = await client.get(f"/clients/{cid}/contacts")
        assert resp.status_code == 200
