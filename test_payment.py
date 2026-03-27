import urllib.request, json

BASE = "http://localhost:8000/api/v1"

def post_json(url, payload, token=None):
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def get_json(url, token=None):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# Login
code, resp = post_json(BASE + "/auth/login",
    {"email": "accountant@kavyatransports.com", "password": "demo123"})
print("Login:", code)
token = (resp.get("data") or {}).get("access_token")
if not token:
    print("No token:", resp)
    exit(1)

# Get receivables
code, recs = get_json(BASE + "/accountant/receivables", token)
print("Receivables:", code, "count:", len(recs.get("data", [])))
items = recs.get("data", [])
if not items:
    print("No receivables found")
    exit(1)

first = items[0]
print("First item:", {k: first.get(k) for k in ["id", "invoice_number", "amount_due", "client_id"]})

# Try record payment
code2, resp2 = post_json(
    BASE + "/receivables/record-payment",
    {
        "invoice_id": first["id"],
        "amount_paid": min(float(first["amount_due"]), 100.0),
        "payment_mode": "CASH",
        "payment_date": "2026-03-22"
    },
    token
)
print("Record payment HTTP:", code2)
print(json.dumps(resp2, indent=2)[:1200])
