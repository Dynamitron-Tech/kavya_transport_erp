import asyncio
import os
from typing import Any, Dict, List, Optional, Tuple

import httpx

BASE_URL = "http://localhost:8001/api/v1"

USERS = {
    "admin": [
        {"email": os.getenv("ERP_ADMIN_EMAIL", "admin@kavya.com"), "password": os.getenv("ERP_ADMIN_PASSWORD", "password123")},
        {"email": "admin@kavyatransports.com", "password": "admin123"},
    ],
    "manager": [
        {"email": os.getenv("ERP_MANAGER_EMAIL", "manager@kavya.com"), "password": os.getenv("ERP_MANAGER_PASSWORD", "password123")},
        {"email": "manager@kavyatransports.com", "password": "demo123"},
    ],
    "fleet": [
        {"email": os.getenv("ERP_FLEET_EMAIL", "fleet@kavya.com"), "password": os.getenv("ERP_FLEET_PASSWORD", "password123")},
        {"email": "fleet@kavyatransports.com", "password": "demo123"},
    ],
    "accountant": [
        {"email": os.getenv("ERP_ACCOUNTANT_EMAIL", "accountant@kavya.com"), "password": os.getenv("ERP_ACCOUNTANT_PASSWORD", "password123")},
        {"email": "accountant@kavyatransports.com", "password": "demo123"},
    ],
    "pa": [
        {"email": os.getenv("ERP_PA_EMAIL", "pa@kavya.com"), "password": os.getenv("ERP_PA_PASSWORD", "password123")},
        {"email": "pa@kavyatransports.com", "password": "demo123"},
    ],
    "driver": [
        {"email": os.getenv("ERP_DRIVER_EMAIL", "driver@kavya.com"), "password": os.getenv("ERP_DRIVER_PASSWORD", "password123")},
        {"email": "driver@kavyatransports.com", "password": "demo123"},
    ],
}

ENDPOINTS_TO_TEST: List[Tuple[str, str, Optional[Dict[str, Any]], str]] = [
    ("POST", "/auth/login", None, "public"),
    ("GET", "/auth/me", None, "admin"),
    ("GET", "/clients", None, "admin"),
    ("GET", "/vehicles", None, "admin"),
    ("GET", "/drivers", None, "admin"),
    ("GET", "/routes", None, "admin"),
    ("GET", "/jobs", None, "admin"),
    ("GET", "/lr", None, "admin"),
    ("GET", "/ewb", None, "admin"),
    ("GET", "/trips", None, "admin"),
    ("GET", "/tracking/live", None, "admin"),
    ("GET", "/expenses", None, "admin"),
    ("GET", "/fuel", None, "admin"),
    ("GET", "/attendance", None, "admin"),
    ("GET", "/checklists", None, "admin"),
    ("GET", "/invoices", None, "admin"),
    ("GET", "/banking", None, "admin"),
    ("GET", "/ledger", None, "admin"),
    ("GET", "/tyre", None, "admin"),
    ("GET", "/service", None, "admin"),
    ("GET", "/notifications", None, "admin"),
    ("GET", "/notifications/unread-count", None, "admin"),
    ("GET", "/reports/dashboard", None, "admin"),
    ("GET", "/reports/trip-summary", None, "admin"),
    ("GET", "/reports/vehicle-performance", None, "admin"),
    ("GET", "/reports/driver-performance", None, "admin"),
    ("GET", "/reports/fuel-analysis", None, "admin"),
    ("GET", "/reports/revenue-analysis", None, "admin"),
    ("GET", "/reports/expense-analysis", None, "admin"),
    ("GET", "/reports/route-analysis", None, "admin"),
    ("GET", "/reports/client-outstanding", None, "admin"),
    ("GET", "/admin/health", None, "admin"),
]


async def run_tests() -> None:
    tokens: Dict[str, str] = {}
    successful_creds: Dict[str, Dict[str, str]] = {}
    results: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        for role, creds_list in USERS.items():
            logged_in = False
            for creds in creds_list:
                try:
                    r = await client.post(f"{BASE_URL}/auth/login", json=creds)
                    if r.status_code == 200:
                        payload = r.json()
                        token = payload.get("data", {}).get("access_token")
                        if token:
                            tokens[role] = token
                            successful_creds[role] = creds
                            print(f"OK Login: {role} ({creds['email']})")
                            logged_in = True
                            break
                except Exception:
                    continue

            if not logged_in:
                print(f"FAIL Login: {role} -> all credential candidates failed")

        for method, path, body, role in ENDPOINTS_TO_TEST:
            token = tokens.get(role, "")
            if role != "public" and not token:
                print(f"FAIL {method} {path} -> AUTH_MISSING ({role})")
                results.append({"endpoint": f"{method} {path}", "status": "AUTH_MISSING", "ok": False})
                continue

            headers = {"Authorization": f"Bearer {token}"} if token else {}
            url = f"{BASE_URL}{path}"
            try:
                if method == "GET":
                    r = await client.get(url, headers=headers)
                elif method == "POST":
                    payload = body
                    if path == "/auth/login":
                        payload = successful_creds.get("admin", USERS["admin"][0])
                    r = await client.post(url, json=payload, headers=headers)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                ok = r.status_code < 400
                results.append({"endpoint": f"{method} {path}", "status": r.status_code, "ok": ok})
                mark = "OK" if ok else "FAIL"
                print(f"{mark} {method} {path} -> {r.status_code}")
            except Exception as e:
                print(f"ERROR {method} {path} -> {repr(e)}")
                results.append({"endpoint": f"{method} {path}", "status": "ERROR", "ok": False})

    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed > 0:
        print("\nFAILED ENDPOINTS:")
        for r in results:
            if not r["ok"]:
                print(f"  FAIL {r['endpoint']} -> {r['status']}")


if __name__ == "__main__":
    asyncio.run(run_tests())
