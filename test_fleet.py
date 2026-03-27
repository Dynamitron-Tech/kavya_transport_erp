#!/usr/bin/env python3
import subprocess, json

def get_token():
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/auth/login",
         "-H", "Content-Type: application/json",
         "-d", '{"email":"admin@kavyatransports.com","password":"admin123"}'],
        capture_output=True, text=True)
    return json.loads(r.stdout)["data"]["access_token"]

tk = get_token()

endpoints = [
    "fleet/dashboard/recent-alerts",
    "fleet/dashboard/expiring-documents",
    "fleet/dashboard/upcoming-maintenance",
    "fleet/dashboard/active-trips",
]

for ep in endpoints:
    r = subprocess.run(["curl", "-s", f"http://localhost:8000/api/v1/{ep}",
         "-H", f"Authorization: Bearer {tk}"], capture_output=True, text=True)
    d = json.loads(r.stdout)
    data = d.get("data")
    if isinstance(data, list):
        dtype = f"array[{len(data)}]"
    elif isinstance(data, dict):
        dtype = f"object({list(data.keys())[:5]})"
    else:
        dtype = str(type(data).__name__)
    print(f"{ep:45s} -> data type: {dtype}")
