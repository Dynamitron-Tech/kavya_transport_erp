#!/usr/bin/env python3
import subprocess, json

def get_token():
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/auth/login",
         "-H", "Content-Type: application/json",
         "-d", '{"email":"admin@kavyatransports.com","password":"admin123"}'],
        capture_output=True, text=True)
    return json.loads(r.stdout)["data"]["access_token"]

tk = get_token()

job_payload = {
    "client_id": 1,
    "origin_address": "Chennai, Tamil Nadu",
    "origin_city": "Chennai",
    "origin_state": "Tamil Nadu",
    "destination_address": "Bangalore, Karnataka",
    "destination_city": "Bangalore",
    "destination_state": "Karnataka",
    "contract_type": "spot",
    "priority": "normal",
    "material_type": "General Goods",
    "quantity": 20,
    "quantity_unit": "tonnes",
    "vehicle_type_required": "TRUCK",
    "num_vehicles_required": 1,
    "expected_delivery_date": "2026-03-20T00:00:00",
    "rate_type": "per_trip",
    "agreed_rate": 50000,
    "loading_charges": 0,
    "unloading_charges": 0,
    "other_charges": 0,
    "notes": "Test job from smoke test"
}

r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/jobs",
     "-H", f"Authorization: Bearer {tk}",
     "-H", "Content-Type: application/json",
     "-d", json.dumps(job_payload)],
    capture_output=True, text=True)
print("=== CREATE JOB ===")
d = json.loads(r.stdout)
if d.get("success"):
    job = d["data"]
    print(f"OK: Job {job.get('job_number')} created (id={job.get('id')}, status={job.get('status')})")
    job_id = job.get("id")
else:
    print(f"FAIL: {json.dumps(d, indent=2)[:300]}")
    job_id = None

if job_id:
    r = subprocess.run(["curl", "-s", "-X", "POST", f"http://localhost:8000/api/v1/jobs/{job_id}/submit-for-approval",
         "-H", f"Authorization: Bearer {tk}"],
        capture_output=True, text=True)
    print("\n=== SUBMIT FOR APPROVAL ===")
    d = json.loads(r.stdout)
    print(f"{'OK' if d.get('success') else 'FAIL'}: {d.get('message', json.dumps(d)[:200])}")

    r = subprocess.run(["curl", "-s", "-X", "POST", f"http://localhost:8000/api/v1/jobs/{job_id}/approve",
         "-H", f"Authorization: Bearer {tk}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"approved": True, "notes": "Approved"})],
        capture_output=True, text=True)
    print("\n=== APPROVE JOB ===")
    d = json.loads(r.stdout)
    print(f"{'OK' if d.get('success') else 'FAIL'}: {d.get('message', json.dumps(d)[:200])}")

    r = subprocess.run(["curl", "-s", f"http://localhost:8000/api/v1/jobs/{job_id}",
         "-H", f"Authorization: Bearer {tk}"],
        capture_output=True, text=True)
    d = json.loads(r.stdout)
    job = d["data"]
    print(f"\n=== FINAL STATUS: {job.get('status')} ===")

    # Now create LR on this job
    lr_payload = {
        "job_id": job_id,
        "consignor_name": "Sender Corp",
        "consignor_gstin": "33AABCU9603R1ZM",
        "consignor_address": "Chennai",
        "consignee_name": "Receiver Corp",
        "consignee_gstin": "29AABCU9603R1ZM",
        "consignee_address": "Bangalore",
        "from_city": "Chennai",
        "to_city": "Bangalore",
        "material_description": "General Goods",
        "quantity": 20,
        "quantity_unit": "tonnes",
        "declared_value": 500000,
        "charged_weight": 20,
        "freight_amount": 50000,
        "notes": "Test LR"
    }
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/lr",
         "-H", f"Authorization: Bearer {tk}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(lr_payload)],
        capture_output=True, text=True)
    print("\n=== CREATE LR ===")
    d = json.loads(r.stdout)
    if d.get("success"):
        lr = d["data"]
        print(f"OK: LR {lr.get('lr_number')} created (id={lr.get('id')})")
        lr_id = lr.get("id")
    else:
        print(f"FAIL: {json.dumps(d, indent=2)[:400]}")
        lr_id = None

    # Create trip
    trip_payload = {
        "job_id": job_id,
        "vehicle_id": 1,
        "driver_id": 1,
        "planned_start": "2026-03-18T06:00:00",
        "planned_end": "2026-03-19T18:00:00",
        "origin": "Chennai",
        "destination": "Bangalore",
        "notes": "Test trip"
    }
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/trips",
         "-H", f"Authorization: Bearer {tk}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(trip_payload)],
        capture_output=True, text=True)
    print("\n=== CREATE TRIP ===")
    d = json.loads(r.stdout)
    if d.get("success"):
        trip = d["data"]
        print(f"OK: Trip {trip.get('trip_number')} created (id={trip.get('id')}, status={trip.get('status')})")
    else:
        print(f"FAIL: {json.dumps(d, indent=2)[:400]}")
