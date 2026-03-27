#!/usr/bin/env python3
"""Smoke test for all checklist items."""
import requests

BASE = 'http://localhost:8000/api/v1'

# 1. Login
r = requests.post(f'{BASE}/auth/login', json={'email':'admin@kavyatransports.com','password':'admin123'})
tok = r.json()['data']['access_token']
H = {'Authorization': f'Bearer {tok}'}
print('1. LOGIN:', 'PASS' if r.status_code==200 else 'FAIL')

# 2. Dashboard overview (KPIs)
r = requests.get(f'{BASE}/dashboard/overview', headers=H)
d = r.json().get('data', {})
print(f'2. DASHBOARD KPIs: {"PASS" if r.status_code==200 else "FAIL"} (vehicles={d.get("total_vehicles")}, trips={d.get("active_trips")}, revenue={d.get("monthly_revenue")})')

# 3. Fleet dashboard KPIs
r = requests.get(f'{BASE}/fleet/dashboard/kpis', headers=H)
print('3. FLEET KPIs:', 'PASS' if r.status_code==200 else 'FAIL')

# 4. Accountant KPIs
r = requests.get(f'{BASE}/dashboard/accountant/kpis', headers=H)
print('4. ACCOUNTANT KPIs:', 'PASS' if r.status_code==200 else 'FAIL')

# 5. PA KPIs
r = requests.get(f'{BASE}/dashboard/pa/kpis', headers=H)
print('5. PA KPIs:', 'PASS' if r.status_code==200 else 'FAIL')

# 6. Create job
r = requests.post(f'{BASE}/jobs', headers=H, json={
    'job_date': '2025-01-15', 'client_id': 1,
    'origin_address': 'Mumbai', 'origin_city': 'Mumbai',
    'destination_address': 'Delhi', 'destination_city': 'Delhi',
    'material_type': 'Steel', 'quantity': 10, 'quantity_unit': 'tonnes',
    'vehicle_type_required': 'trailer', 'agreed_rate': 50000,
    'rate_type': 'per_trip', 'num_vehicles_required': 1
})
job_id = r.json().get('data', {}).get('id')
print(f'6. CREATE JOB: {"PASS" if r.status_code in (200,201) else "FAIL"} (id={job_id})')

# 7. Create LR
r = requests.post(f'{BASE}/lr', headers=H, json={
    'lr_date': '2025-01-15', 'job_id': job_id or 1,
    'consignor_name': 'Test Consignor', 'consignee_name': 'Test Consignee',
    'origin': 'Mumbai', 'destination': 'Delhi',
    'freight_amount': 25000, 'payment_mode': 'to_be_billed'
})
lr_id = r.json().get('data', {}).get('id')
print(f'7. CREATE LR: {"PASS" if r.status_code in (200,201) else "FAIL"} (id={lr_id})')

# 8. E-way bills list
r = requests.get(f'{BASE}/ewb', headers=H)
print('8. EWAY BILLS LIST:', 'PASS' if r.status_code==200 else 'FAIL')

# 9. Notifications/alerts
r = requests.get(f'{BASE}/dashboard/notifications', headers=H)
d = r.json().get('data', [])
print(f'9. NOTIFICATIONS: {"PASS" if r.status_code==200 else "FAIL"} (count={len(d) if isinstance(d, list) else "??"})')

# 10. GPS positions
r = requests.get(f'{BASE}/tracking/gps/positions', headers=H)
print('10. GPS POSITIONS:', 'PASS' if r.status_code==200 else 'FAIL')

# 11. Compliance summary
r = requests.get(f'{BASE}/compliance/vehicles/summary', headers=H)
print('11. COMPLIANCE:', 'PASS' if r.status_code==200 else 'FAIL')

# 12. Trips lookup endpoints
for ep in ['jobs', 'vehicles', 'drivers', 'routes']:
    r = requests.get(f'{BASE}/trips/lookup/{ep}', headers=H)
    print(f'12. TRIP LOOKUP/{ep}: {"PASS" if r.status_code==200 else "FAIL"}')

# 13. Create trip
if job_id:
    r = requests.post(f'{BASE}/trips', headers=H, json={
        'trip_date': '2025-01-15', 'job_id': job_id,
        'vehicle_id': 1, 'driver_id': 1,
        'origin': 'Mumbai', 'destination': 'Delhi'
    })
    trip_id = r.json().get('data', {}).get('id')
    print(f'13. CREATE TRIP: {"PASS" if r.status_code in (200,201) else "FAIL"} (id={trip_id})')
else:
    print('13. CREATE TRIP: SKIP (no job)')

# 14. WebSocket endpoint check
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
ws_ok = s.connect_ex(('localhost', 8000)) == 0
s.close()
print(f'14. WEBSOCKET PORT: {"PASS" if ws_ok else "FAIL"}')

print()
print('=== SMOKE TEST COMPLETE ===')
