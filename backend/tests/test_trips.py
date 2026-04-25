# tests/test_trips.py — Trip CRUD + status + expenses tests
import pytest
from httpx import AsyncClient
from datetime import date, datetime


async def _create_trip_prerequisites(client: AsyncClient) -> dict:
    """Create client → job → vehicle → driver → LR needed for a trip."""
    c = await client.post("/clients", json={"name": "Trip Test Client"})
    cid = c.json()["data"]["id"]

    j = await client.post("/jobs", json={
        "job_date": str(date.today()),
        "client_id": cid,
        "origin_address": "Chennai Port",
        "origin_city": "Chennai",
        "destination_address": "Tuticorin Port",
        "destination_city": "Tuticorin",
    })
    jid = j.json()["data"]["id"]

    v = await client.post("/vehicles", json={"registration_number": "TN38AB9999"})
    vid = v.json()["data"]["id"]

    d = await client.post("/drivers", json={"first_name": "Senthil", "phone": "9988001122"})
    did = d.json()["data"]["id"]

    lr = await client.post("/lr", json={
        "lr_date": str(date.today()),
        "job_id": jid,
        "consignor_name": "Port Chemicals",
        "consignee_name": "Southern Traders",
        "origin": "Chennai",
        "destination": "Tuticorin",
    })
    lr_id = lr.json()["data"]["id"]

    return {"client_id": cid, "job_id": jid, "vehicle_id": vid, "driver_id": did, "lr_id": lr_id}


class TestTripCreate:
    async def test_create_trip(self, client: AsyncClient):
        pre = await _create_trip_prerequisites(client)
        resp = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
            "lr_ids": [pre["lr_id"]],
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["trip_number"].startswith("TRP")

    async def test_create_trip_missing_fields(self, client: AsyncClient):
        resp = await client.post("/trips", json={"trip_date": str(date.today())})
        assert resp.status_code == 422


class TestTripRead:
    async def test_list_trips_empty(self, client: AsyncClient):
        resp = await client.get("/trips")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_get_trip_by_id(self, client: AsyncClient):
        pre = await _create_trip_prerequisites(client)
        create = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        tid = create.json()["data"]["id"]
        resp = await client.get(f"/trips/{tid}")
        assert resp.status_code == 200

    async def test_get_trip_not_found(self, client: AsyncClient):
        resp = await client.get("/trips/99999")
        assert resp.status_code == 404


class TestTripUpdate:
    async def test_update_trip(self, client: AsyncClient):
        pre = await _create_trip_prerequisites(client)
        create = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        tid = create.json()["data"]["id"]
        resp = await client.put(f"/trips/{tid}", json={"planned_distance_km": 600})
        assert resp.status_code == 200

    async def test_update_trip_not_found(self, client: AsyncClient):
        resp = await client.put("/trips/99999", json={"planned_distance_km": 100})
        assert resp.status_code == 404


class TestTripDelete:
    async def test_delete_trip(self, client: AsyncClient):
        pre = await _create_trip_prerequisites(client)
        create = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        tid = create.json()["data"]["id"]
        resp = await client.delete(f"/trips/{tid}")
        assert resp.status_code == 200

    async def test_delete_trip_not_found(self, client: AsyncClient):
        resp = await client.delete("/trips/99999")
        assert resp.status_code == 404


class TestTripStatus:
    async def _create_trip(self, client: AsyncClient) -> int:
        pre = await _create_trip_prerequisites(client)
        resp = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        return resp.json()["data"]["id"]

    async def test_trip_status_lifecycle(self, client: AsyncClient):
        tid = await self._create_trip(client)
        transitions = ["started", "loading", "in_transit", "unloading", "completed"]

        async def _create_trip_ewb() -> None:
            trip_resp = await client.get(f"/trips/{tid}")
            assert trip_resp.status_code == 200, f"Failed trip fetch: {trip_resp.text}"
            job_id = trip_resp.json()["data"].get("job_id")

            resp = await client.post("/eway-bills", json={
                "job_id": job_id,
                "trip_id": tid,
                "document_number": f"INV-{tid}",
                "document_date": str(date.today()),
                "from_gstin": "33ABCDE1234F1Z5",
                "from_name": "Test Supplier",
                "from_place": "Chennai",
                "from_state_code": "33",
                "from_pincode": "600001",
                "to_name": "Test Receiver",
                "to_place": "Tuticorin",
                "to_state_code": "33",
                "to_pincode": "628001",
                "total_value": 10000,
                "total_invoice_value": 11800,
                "vehicle_number": "TN01AB1234",
                "approximate_distance": 300,
            })
            assert resp.status_code == 201, f"Failed EWB create: {resp.text}"

        for status in transitions:
            if status == "in_transit":
                await _create_trip_ewb()
            resp = await client.post(
                f"/trips/{tid}/status",
                json={"status": status, "remarks": f"Moving to {status}"},
            )
            assert resp.status_code == 200, f"Failed {status}: {resp.text}"

    async def test_trip_invalid_transition(self, client: AsyncClient):
        tid = await self._create_trip(client)
        # planned -> completed directly should fail
        resp = await client.post(f"/trips/{tid}/status", json={"status": "completed"})
        assert resp.status_code == 400


class TestTripExpenses:
    async def _create_trip(self, client: AsyncClient) -> int:
        pre = await _create_trip_prerequisites(client)
        resp = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        return resp.json()["data"]["id"]

    async def test_add_expense(self, client: AsyncClient):
        tid = await self._create_trip(client)
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "category": "toll",
            "amount": 350,
            "payment_mode": "cash",
            "expense_date": datetime.utcnow().isoformat(),
        })
        assert resp.status_code == 201

    async def test_list_expenses(self, client: AsyncClient):
        tid = await self._create_trip(client)
        await client.post(f"/trips/{tid}/expenses", json={
            "category": "food",
            "amount": 200,
            "expense_date": datetime.utcnow().isoformat(),
        })
        resp = await client.get(f"/trips/{tid}/expenses")
        assert resp.status_code == 200


class TestTripFuel:
    async def _create_trip(self, client: AsyncClient) -> int:
        pre = await _create_trip_prerequisites(client)
        resp = await client.post("/trips", json={
            "trip_date": str(date.today()),
            "job_id": pre["job_id"],
            "vehicle_id": pre["vehicle_id"],
            "driver_id": pre["driver_id"],
            "origin": "Chennai",
            "destination": "Tuticorin",
        })
        return resp.json()["data"]["id"]

    async def test_add_fuel(self, client: AsyncClient):
        tid = await self._create_trip(client)
        resp = await client.post(f"/trips/{tid}/fuel", json={
            "fuel_date": datetime.utcnow().isoformat(),
            "fuel_type": "diesel",
            "quantity_litres": 120,
            "rate_per_litre": 95.5,
            "total_amount": 11460,
            "pump_name": "HP Fuel Station",
        })
        assert resp.status_code == 201

    async def test_list_fuel(self, client: AsyncClient):
        tid = await self._create_trip(client)
        resp = await client.get(f"/trips/{tid}/fuel")
        assert resp.status_code == 200
