import requests, jwt, datetime

token = jwt.encode({
    'sub': '6',
    'user_id': 6,
    'email': 'driver@kavyatransports.com',
    'roles': ['driver'],
    'permissions': ['expense:read', 'expense:create'],
    'type': 'access',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    'iat': datetime.datetime.utcnow(),
}, 'kavya-transport-erp-super-secret-key-2026-development', algorithm='HS256')

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Test POST
data = {
    'category': 'fuel',
    'amount': 200,
    'payment_mode': 'cash',
    'description': 'Test fuel',
    'expense_date': datetime.datetime.utcnow().isoformat(),
    'biometric_verified': False,
}
r = requests.post('http://localhost:8000/api/v1/expenses', json=data, headers=headers)
print(f'POST status: {r.status_code}')
print(f'POST body: {r.text[:500]}')

# Test GET
r2 = requests.get('http://localhost:8000/api/v1/expenses', headers=headers)
print(f'GET status: {r2.status_code}')
print(f'GET body: {r2.text[:500]}')
