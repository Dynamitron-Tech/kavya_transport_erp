# tests/test_vehicles.py — Vehicle CRUD tests
import pytest
from httpx import AsyncClient


SAMPLE_VEHICLE = {
    "registration_number": "TN01AB1234",
    "vehicle_type": "truck",
    "make": "Tata",
    "model": "Prima 4028.S",
    "capacity_tons": 28.0,
    "fuel_type": "diesel",
    "ownership_type": "owned",
}


class TestVehicleCreate:
    async def test_create_vehicle(self, client: AsyncClient):
        resp = await client.post("/vehicles", json=SAMPLE_VEHICLE)
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] > 0

    async def test_create_vehicle_minimal(self, client: AsyncClient):
        resp = await client.post("/vehicles", json={"registration_number": "TN02XY5678"})
        assert resp.status_code == 201

    async def test_create_vehicle_missing_reg(self, client: AsyncClient):
        resp = await client.post("/vehicles", json={"make": "Ashok Leyland"})
        assert resp.status_code == 422

    async def test_create_vehicle_empty_reg(self, client: AsyncClient):
        resp = await client.post("/vehicles", json={"registration_number": ""})
        assert resp.status_code == 422


class TestVehicleRead:
    async def test_list_vehicles_empty(self, client: AsyncClient):
        resp = await client.get("/vehicles")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True

    async def test_list_vehicles_with_data(self, client: AsyncClient):
        await client.post("/vehicles", json=SAMPLE_VEHICLE)
        resp = await client.get("/vehicles")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["total"] >= 1

    async def test_get_vehicle_by_id(self, client: AsyncClient):
        create = await client.post("/vehicles", json=SAMPLE_VEHICLE)
        vid = create.json()["data"]["id"]
        resp = await client.get(f"/vehicles/{vid}")
        assert resp.status_code == 200

    async def test_get_vehicle_not_found(self, client: AsyncClient):
        resp = await client.get("/vehicles/99999")
        assert resp.status_code == 404


class TestVehicleUpdate:
    async def test_update_vehicle(self, client: AsyncClient):
        create = await client.post("/vehicles", json=SAMPLE_VEHICLE)
        vid = create.json()["data"]["id"]
        resp = await client.put(f"/vehicles/{vid}", json={"capacity_tons": 30.0})
        assert resp.status_code == 200

    async def test_update_vehicle_not_found(self, client: AsyncClient):
        resp = await client.put("/vehicles/99999", json={"make": "Eicher"})
        assert resp.status_code == 404


class TestVehicleDelete:
    async def test_delete_vehicle(self, client: AsyncClient):
        create = await client.post("/vehicles", json=SAMPLE_VEHICLE)
        vid = create.json()["data"]["id"]
        resp = await client.delete(f"/vehicles/{vid}")
        assert resp.status_code == 200

    async def test_delete_vehicle_not_found(self, client: AsyncClient):
        resp = await client.delete("/vehicles/99999")
        assert resp.status_code == 404


class TestVehicleSummary:
    async def test_fleet_summary(self, client: AsyncClient):
        await client.post("/vehicles", json=SAMPLE_VEHICLE)
        resp = await client.get("/vehicles/summary")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "total" in data or isinstance(data, dict)

    async def test_expiring_vehicles(self, client: AsyncClient):
        resp = await client.get("/vehicles/expiring", params={"days": 30})
        assert resp.status_code == 200
