# tests/test_drivers.py — Driver CRUD tests
import pytest
from httpx import AsyncClient
from datetime import date


SAMPLE_DRIVER = {
    "first_name": "Murugan",
    "last_name": "S",
    "phone": "9876543210",
    "city": "Madurai",
    "state": "Tamil Nadu",
    "designation": "driver",
    "salary_type": "monthly",
    "base_salary": 25000,
}


class TestDriverCreate:
    async def test_create_driver(self, client: AsyncClient):
        resp = await client.post("/drivers", json=SAMPLE_DRIVER)
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] > 0

    async def test_create_driver_minimal(self, client: AsyncClient):
        resp = await client.post("/drivers", json={"first_name": "Raju", "phone": "9988776655"})
        assert resp.status_code == 201

    async def test_create_driver_missing_name(self, client: AsyncClient):
        resp = await client.post("/drivers", json={"phone": "9988776655"})
        assert resp.status_code == 422

    async def test_create_driver_missing_phone(self, client: AsyncClient):
        resp = await client.post("/drivers", json={"first_name": "Test"})
        assert resp.status_code == 422

    async def test_create_driver_short_phone(self, client: AsyncClient):
        resp = await client.post("/drivers", json={"first_name": "Test", "phone": "12345"})
        assert resp.status_code == 422

    async def test_create_driver_with_license(self, client: AsyncClient):
        data = {
            **SAMPLE_DRIVER,
            "licenses": [
                {
                    "license_number": "TN0120230012345",
                    "license_type": "hmv",
                    "expiry_date": "2026-12-31",
                }
            ],
        }
        resp = await client.post("/drivers", json=data)
        assert resp.status_code == 201


class TestDriverRead:
    async def test_list_drivers_empty(self, client: AsyncClient):
        resp = await client.get("/drivers")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_list_drivers_with_data(self, client: AsyncClient):
        await client.post("/drivers", json=SAMPLE_DRIVER)
        resp = await client.get("/drivers")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1

    async def test_get_driver_by_id(self, client: AsyncClient):
        create = await client.post("/drivers", json=SAMPLE_DRIVER)
        did = create.json()["data"]["id"]
        resp = await client.get(f"/drivers/{did}")
        assert resp.status_code == 200

    async def test_get_driver_not_found(self, client: AsyncClient):
        resp = await client.get("/drivers/99999")
        assert resp.status_code == 404


class TestDriverUpdate:
    async def test_update_driver(self, client: AsyncClient):
        create = await client.post("/drivers", json=SAMPLE_DRIVER)
        did = create.json()["data"]["id"]
        resp = await client.put(f"/drivers/{did}", json={"city": "Salem"})
        assert resp.status_code == 200

    async def test_update_driver_not_found(self, client: AsyncClient):
        resp = await client.put("/drivers/99999", json={"city": "Trichy"})
        assert resp.status_code == 404


class TestDriverDelete:
    async def test_delete_driver(self, client: AsyncClient):
        create = await client.post("/drivers", json=SAMPLE_DRIVER)
        did = create.json()["data"]["id"]
        resp = await client.delete(f"/drivers/{did}")
        assert resp.status_code == 200

    async def test_delete_driver_not_found(self, client: AsyncClient):
        resp = await client.delete("/drivers/99999")
        assert resp.status_code == 404


class TestDriverDashboard:
    async def test_driver_dashboard(self, client: AsyncClient):
        await client.post("/drivers", json=SAMPLE_DRIVER)
        resp = await client.get("/drivers/dashboard")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert isinstance(data, dict)
