"""
Creates a new DRIVER_ASSIGNED test trip for driver_id=14 via the live API.
Handles Job + Trip creation end-to-end.
"""
import httpx
import json
from datetime import date

BASE = "http://localhost:8000/api/v1"


def main():
    # --- Auth ---
    r = httpx.post(f"{BASE}/auth/login", json={"email": "admin@kavyatransports.com", "password": "admin123"})
    if r.status_code != 200:
        print("Login failed:", r.status_code, r.text); return
    rj = r.json()
    token = rj.get("access_token") or rj.get("token")
    if not token and isinstance(rj.get("data"), dict):
        token = rj["data"].get("access_token")
    if not token:
        print("No token in response:", rj); return
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in as admin.")

    # --- Fetch a client ---
    r = httpx.get(f"{BASE}/clients", headers=headers)
    r.raise_for_status()
    data = r.json()
    clients = data if isinstance(data, list) else data.get("data", data.get("items", []))
    if not clients:
        print("No clients found:", data); return
    client = clients[0]
    client_id = client["id"]
    print(f"Using client: {client.get('name', client_id)} (id={client_id})")

    # --- Fetch a vehicle ---
    r = httpx.get(f"{BASE}/vehicles", headers=headers)
    r.raise_for_status()
    data = r.json()
    vehicles = data if isinstance(data, list) else data.get("data", data.get("items", []))
    if not vehicles:
        print("No vehicles found:", data); return
    vehicle = vehicles[0]
    vehicle_id = vehicle["id"]
    vehicle_reg = vehicle.get("registration_number", "")
    print(f"Using vehicle: {vehicle_reg} (id={vehicle_id})")

    # --- Create Job ---
    today = date.today().isoformat()
    job_payload = {
        "client_id": client_id,
        "job_date": today,
        "origin_address": "Anna Salai, Chennai",
        "origin_city": "Chennai",
        "origin_state": "Tamil Nadu",
        "destination_address": "Gandhipuram, Coimbatore",
        "destination_city": "Coimbatore",
        "destination_state": "Tamil Nadu",
        "material_type": "General Goods",
        "quantity": 500,
        "quantity_unit": "kgs",
        "rate_type": "per_trip",
        "agreed_rate": 18000,
    }
    r = httpx.post(f"{BASE}/jobs", json=job_payload, headers=headers)
    if r.status_code not in (200, 201):
        print("Job creation failed:", r.status_code, r.text[:600]); return
    job_resp = r.json()
    job_data = job_resp.get("data", job_resp)
    job_id = job_data["id"]
    job_number = job_data.get("job_number", job_id)
    print(f"Created Job: {job_number} (id={job_id})")

    # --- Create Trip under that Job ---
    trip_payload = {
        "job_id": job_id,
        "vehicle_id": vehicle_id,
        "driver_id": 14,
        "trip_date": today,
        "origin": "Chennai",
        "destination": "Coimbatore",
        "planned_distance_km": 500,
        "driver_pay": 5000,
        "driver_advance": 0,
        "remarks": "Test trip — Chennai to Coimbatore (auto-created for demo)",
    }
    r = httpx.post(f"{BASE}/trips", json=trip_payload, headers=headers)
    if r.status_code not in (200, 201):
        print("Trip creation failed:", r.status_code, r.text[:600]); return
    trip_resp = r.json()
    trip_data = trip_resp.get("data", trip_resp)
    trip_id = trip_data["id"]
    trip_number = trip_data.get("trip_number", trip_id)
    print(f"Created Trip: {trip_number} (id={trip_id})")

    # --- Advance trip status to DRIVER_ASSIGNED ---
    # Typical flow: PLANNED -> VEHICLE_ASSIGNED -> DRIVER_ASSIGNED
    for target_status in ["vehicle_assigned", "driver_assigned"]:
        r = httpx.patch(f"{BASE}/trips/{trip_id}/status", json={"status": target_status}, headers=headers)
        if r.status_code not in (200, 201):
            print(f"Status update to {target_status} failed:", r.status_code, r.text[:400])
        else:
            print(f"  Status -> {target_status}")

    print()
    print(f"Done! Trip '{trip_number}' is ready for the demo driver.")
    print(f"Open the app -> Today tab -> Available Trips to see Chennai -> Coimbatore.")


if __name__ == "__main__":
    main()
