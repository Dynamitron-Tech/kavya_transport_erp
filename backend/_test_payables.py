"""Quick test of payables endpoints."""
import httpx

# Login as admin
r = httpx.post('http://localhost:8000/api/v1/auth/login', json={'email': 'admin@kavyatransports.com', 'password': 'admin123'})
token = r.json().get('data', {}).get('access_token', '')
h = {'Authorization': f'Bearer {token}'}

# Test 1: Driver settlements (user_id=6)
r = httpx.get('http://localhost:8000/api/v1/payables/driver/6', headers=h)
data = r.json().get('data', [])
print(f"Driver settlements: {len(data)} records")
for d in data:
    print(f"  #{d['id']} trip_id={d['trip_id']} gross={d['gross_amount_paise']} net={d['net_amount_paise']} status={d['status']}")

# Test 2: Accountant list (all)
r = httpx.get('http://localhost:8000/api/v1/payables/', params={'type': 'driver_settlement'}, headers=h)
data = r.json().get('data', [])
print(f"\nAccountant list (all): {len(data)} records")
for d in data:
    print(f"  #{d['id']} driver={d['driver_first_name']} {d['driver_last_name']} net={d['net_amount_paise']} status={d['status']}")

# Test 3: Accountant list (pending only)
r = httpx.get('http://localhost:8000/api/v1/payables/', params={'type': 'driver_settlement', 'status': 'pending'}, headers=h)
data = r.json().get('data', [])
print(f"\nPending: {len(data)} records")

# Test 4: Approved only
r = httpx.get('http://localhost:8000/api/v1/payables/', params={'type': 'driver_settlement', 'status': 'approved'}, headers=h)
data = r.json().get('data', [])
print(f"Approved: {len(data)} records")

# Test 5: Paid only
r = httpx.get('http://localhost:8000/api/v1/payables/', params={'type': 'driver_settlement', 'status': 'paid'}, headers=h)
data = r.json().get('data', [])
print(f"Paid: {len(data)} records")
