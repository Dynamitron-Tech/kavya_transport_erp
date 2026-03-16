import asyncio
import os
from uuid import uuid4
from datetime import UTC, date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

import httpx

BASE_URL = "http://localhost:8001/api/v1"
ADMIN_CREDENTIALS = [
    {"email": os.getenv("ERP_ADMIN_EMAIL", "admin@kavya.com"), "password": os.getenv("ERP_ADMIN_PASSWORD", "password123")},
    {"email": "admin@kavyatransports.com", "password": "admin123"},
]


def extract_payload(json_obj: Dict[str, Any]) -> Any:
    return json_obj.get("data", json_obj)


def extract_rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("items", "rows", "results", "data"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
    return []


async def get_token(client: httpx.AsyncClient) -> str:
    last_status = "UNKNOWN"
    for creds in ADMIN_CREDENTIALS:
        r = await client.post(f"{BASE_URL}/auth/login", json=creds)
        if r.status_code == 200:
            data = extract_payload(r.json())
            token = data.get("access_token")
            if token:
                return token
        last_status = str(r.status_code)

    raise RuntimeError(f"Unable to login with configured admin credentials (last status: {last_status})")


async def assert_contains(
    client: httpx.AsyncClient,
    endpoint: str,
    item_id: int,
    headers: Dict[str, str],
    label: str,
) -> None:
    r = await client.get(f"{BASE_URL}{endpoint}", headers=headers)
    r.raise_for_status()
    payload = extract_payload(r.json())
    rows = extract_rows(payload)
    if not any(int(row.get("id", -1)) == int(item_id) for row in rows if isinstance(row, dict)):
        raise AssertionError(f"{label} id={item_id} not found in GET {endpoint}")


async def run_flow() -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await get_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        suffix = datetime.now(UTC).strftime("%Y%m%d%H%M%S") + uuid4().hex[:6]
        numeric_suffix = f"{uuid4().int % 100000000:08d}"
        phone_suffix = f"{uuid4().int % 1000000000:09d}"

        # 1) Create Client
        client_payload = {
            "name": f"Connectivity Client {suffix}",
            "phone": "9876543210",
            "email": f"client.{suffix}@example.com",
            "city": "Bengaluru",
            "state": "Karnataka",
        }
        r = await client.post(f"{BASE_URL}/clients", json=client_payload, headers=headers)
        r.raise_for_status()
        client_item = extract_payload(r.json())
        client_id = int(client_item["id"])
        await assert_contains(client, "/clients", client_id, headers, "Client")
        print(f"OK Client created and readable: {client_id}")

        # 2) Create Vehicle
        vehicle_payload = {
            "registration_number": f"KA01{numeric_suffix}",
            "vehicle_type": "truck",
            "num_axles": 2,
            "fuel_type": "diesel",
        }
        r = await client.post(f"{BASE_URL}/vehicles", json=vehicle_payload, headers=headers)
        r.raise_for_status()
        vehicle_item = extract_payload(r.json())
        vehicle_id = int(vehicle_item["id"])
        await assert_contains(client, "/vehicles", vehicle_id, headers, "Vehicle")
        print(f"OK Vehicle created and readable: {vehicle_id}")

        # 3) Create Driver
        driver_payload = {
            "first_name": f"Driver{suffix[-4:]}",
            "phone": f"9{phone_suffix}",
            "designation": "driver",
        }
        r = await client.post(f"{BASE_URL}/drivers", json=driver_payload, headers=headers)
        r.raise_for_status()
        driver_item = extract_payload(r.json())
        driver_id = int(driver_item["id"])
        await assert_contains(client, "/drivers", driver_id, headers, "Driver")
        print(f"OK Driver created and readable: {driver_id}")

        # 4) Create Job
        job_payload = {
            "job_date": date.today().isoformat(),
            "client_id": client_id,
            "origin_address": "Warehouse A",
            "origin_city": "Bengaluru",
            "destination_address": "Yard B",
            "destination_city": "Chennai",
            "num_vehicles_required": 1,
            "rate_type": "per_trip",
        }
        r = await client.post(f"{BASE_URL}/jobs", json=job_payload, headers=headers)
        r.raise_for_status()
        job_item = extract_payload(r.json())
        job_id = int(job_item["id"])
        await assert_contains(client, "/jobs", job_id, headers, "Job")
        print(f"OK Job created and readable: {job_id}")

        # 5) Create LR
        lr_payload = {
            "lr_date": date.today().isoformat(),
            "job_id": job_id,
            "consignor_name": "Test Consignor",
            "consignee_name": "Test Consignee",
            "origin": "Bengaluru",
            "destination": "Chennai",
            "payment_mode": "to_be_billed",
        }
        r = await client.post(f"{BASE_URL}/lr", json=lr_payload, headers=headers)
        r.raise_for_status()
        lr_item = extract_payload(r.json())
        lr_id = int(lr_item["id"])
        await assert_contains(client, "/lr", lr_id, headers, "LR")
        print(f"OK LR created and readable: {lr_id}")

        # 6) Create Trip
        trip_payload = {
            "trip_date": date.today().isoformat(),
            "job_id": job_id,
            "vehicle_id": vehicle_id,
            "driver_id": driver_id,
            "origin": "Bengaluru",
            "destination": "Chennai",
            "lr_ids": [lr_id],
        }
        r = await client.post(f"{BASE_URL}/trips", json=trip_payload, headers=headers)
        r.raise_for_status()
        trip_item = extract_payload(r.json())
        trip_id = int(trip_item["id"])
        await assert_contains(client, "/trips", trip_id, headers, "Trip")
        print(f"OK Trip created and readable: {trip_id}")

        # 7) Submit Expense for Trip
        expense_payload = {
            "category": "fuel",
            "amount": 500.0,
            "payment_mode": "cash",
            "expense_date": datetime.now(UTC).replace(tzinfo=None).isoformat(),
            "description": "Connectivity test expense",
        }
        r = await client.post(f"{BASE_URL}/trips/{trip_id}/expenses", json=expense_payload, headers=headers)
        r.raise_for_status()
        expense_item = extract_payload(r.json())
        expense_id = int(expense_item["id"])

        r = await client.get(f"{BASE_URL}/trips/{trip_id}/expenses", headers=headers)
        r.raise_for_status()
        expenses_payload = extract_payload(r.json())
        expenses = extract_rows(expenses_payload)
        if not any(int(item.get("id", -1)) == expense_id for item in expenses if isinstance(item, dict)):
            raise AssertionError("Expense not found after creation")
        print(f"OK Expense created and readable: {expense_id}")

        # 8) Create Invoice
        invoice_payload = {
            "invoice_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=7)).isoformat(),
            "client_id": client_id,
            "billing_name": client_payload["name"],
            "items": [
                {
                    "description": "Connectivity test billing",
                    "quantity": 1,
                    "rate": 1000,
                    "tax_rate": 18,
                    "trip_id": trip_id,
                    "lr_id": lr_id,
                }
            ],
        }
        r = await client.post(f"{BASE_URL}/finance/invoices", json=invoice_payload, headers=headers)
        r.raise_for_status()
        invoice_item = extract_payload(r.json())
        invoice_id = int(invoice_item["id"])

        r = await client.get(f"{BASE_URL}/finance/invoices", headers=headers)
        r.raise_for_status()
        invoices_payload = extract_payload(r.json())
        invoices = extract_rows(invoices_payload)
        if not any(int(item.get("id", -1)) == invoice_id for item in invoices if isinstance(item, dict)):
            raise AssertionError("Invoice not found after creation")
        print(f"OK Invoice created and readable: {invoice_id}")

        print("\nSUCCESS: End-to-end data flow checks passed")


if __name__ == "__main__":
    asyncio.run(run_flow())
