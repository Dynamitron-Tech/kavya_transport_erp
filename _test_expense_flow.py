import requests

BASE = "http://localhost:8000/api/v1"

# Login as admin
r = requests.post(f"{BASE}/auth/login", json={"email": "admin@kavyatransports.com", "password": "admin123"})
token = r.json()["data"]["access_token"]
h = {"Authorization": f"Bearer {token}"}

# Test GET /accountant/expenses?status=pending
r = requests.get(f"{BASE}/accountant/expenses", params={"status": "pending"}, headers=h)
print("=== PENDING EXPENSES ===")
print(f"Status: {r.status_code}")
d = r.json()
print(f"Total: {d.get('pagination', {}).get('total', '?')}")
for item in (d.get("data") or [])[:3]:
    print(f"  id={item['id']} cat={item.get('category')} amt={item.get('amount')} status={item.get('status', item.get('expense_status'))}")

# Test PATCH /expenses/ID/status -> approve first pending expense
pending = d.get("data") or []
if pending:
    eid = pending[0]["id"]
    r2 = requests.patch(f"{BASE}/expenses/{eid}/status", json={"status": "approved"}, headers=h)
    print(f"\n=== APPROVE expense {eid} ===")
    print(f"Status: {r2.status_code} -> {r2.json()}")

    # Test PATCH -> mark paid
    r3 = requests.patch(f"{BASE}/expenses/{eid}/status", json={"status": "paid"}, headers=h)
    print(f"\n=== MARK PAID expense {eid} ===")
    print(f"Status: {r3.status_code} -> {r3.json()}")

    # Check approved tab
    r4 = requests.get(f"{BASE}/accountant/expenses", params={"status": "paid"}, headers=h)
    print(f"\n=== PAID EXPENSES ===")
    print(f"Status: {r4.status_code}, Total: {r4.json().get('pagination', {}).get('total', '?')}")
else:
    print("No pending expenses to test with")

# Also test driver's view
r = requests.post(f"{BASE}/auth/login", json={"email": "driver@kavyatransports.com", "password": "demo123"})
dtoken = r.json()["data"]["access_token"]
dh = {"Authorization": f"Bearer {dtoken}"}
r5 = requests.get(f"{BASE}/expenses", headers=dh)
print(f"\n=== DRIVER EXPENSES VIEW ===")
print(f"Status: {r5.status_code}")
d5 = r5.json()
for item in (d5.get("data", {}).get("items") or [])[:3]:
    print(f"  id={item['id']} cat={item.get('category')} amt={item.get('amount')} status={item.get('status')}")
