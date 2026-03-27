"""Test GET /expenses as driver user."""
import asyncio
from app.core.security import create_access_token
import requests

def main():
    token = create_access_token(
        user_id=6,
        email="driver@kavyatransports.com",
        roles=["driver"],
        permissions=["expense:read", "expense:create"],
    )
    print(f"Token: {token[:40]}...")
    
    r = requests.get(
        "http://localhost:8000/api/v1/expenses",
        headers={"Authorization": f"Bearer {token}"},
    )
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text[:500]}")

    # Also test POST
    import json
    payload = {
        "category": "fuel",
        "amount": 200.0,
        "expense_date": "2026-03-20T12:00:00",
        "biometric_verified": False,
        "description": "test from script"
    }
    r2 = requests.post(
        "http://localhost:8000/api/v1/expenses",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(payload),
    )
    print(f"\nPOST Status: {r2.status_code}")
    print(f"POST Body: {r2.text[:500]}")

main()
