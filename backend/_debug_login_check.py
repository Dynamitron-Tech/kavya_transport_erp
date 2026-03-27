import json, urllib.request, urllib.error

def test(email, password):
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/auth/login',
        data=json.dumps({'email': email, 'password': password}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(email, '=>', r.status)
            print(r.read().decode('utf-8')[:220])
    except urllib.error.HTTPError as e:
        print(email, '=>', e.code)
        print(e.read().decode('utf-8'))

test('admin@kavyatransports.com', 'admin123')
