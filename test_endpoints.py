#!/usr/bin/env python3
import subprocess, json

def get_token():
    r = subprocess.run(["curl", "-s", "-X", "POST", "http://localhost:8000/api/v1/auth/login",
         "-H", "Content-Type: application/json",
         "-d", '{"email":"admin@kavyatransports.com","password":"admin123"}'],
        capture_output=True, text=True)
    return json.loads(r.stdout)["data"]["access_token"]

def api(path, tk):
    r = subprocess.run(["curl", "-s", f"http://localhost:8000/api/v1/{path}",
         "-H", f"Authorization: Bearer {tk}"], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        if d.get("success"):
            return "OK"
        elif d.get("detail") == "Not Found":
            return "NOT FOUND"
        else:
            return f"FAIL: {str(d.get('detail', d.get('message', '')))[:80]}"
    except Exception:
        return f"PARSE ERROR: {r.stdout[:80]}"

tk = get_token()
endpoints = [
    "dashboard/overview", "dashboard/charts/revenue-trend",
    "dashboard/charts/expense-breakdown", "dashboard/charts/fleet-utilization",
    "dashboard/notifications", "dashboard/fleet-stats", "dashboard/trip-stats",
    "dashboard/top-clients", "dashboard/revenue-chart",
    "fleet/dashboard", "fleet/dashboard/kpis",
    "fleet/dashboard/charts/fleet-utilization", "fleet/dashboard/charts/fuel-consumption",
    "fleet/dashboard/charts/maintenance-cost", "fleet/dashboard/charts/trip-efficiency",
    "fleet/dashboard/recent-alerts", "fleet/dashboard/expiring-documents",
    "fleet/dashboard/upcoming-maintenance", "fleet/dashboard/active-trips",
    "tracking/live", "tracking/gps/positions", "tracking/alerts",
    "jobs", "clients", "vehicles", "drivers", "trips", "lr", "eway-bills",
    "invoices", "expenses", "ledger", "routes",
    "finance/payments",
    "service", "tyre", "fuel",
    "accountant/dashboard/kpis",
    "vehicles/expiring", "vehicles/summary",
    "documents", "documents/stats",
    "reports/dashboard",
    "users",
    "dashboard/pa/kpis", "dashboard/pa/job-pipeline",
]

for ep in endpoints:
    result = api(ep, tk)
    s = "OK" if result == "OK" else "FAIL"
    print(f"  [{s:4s}] {ep:55s} {result if result != 'OK' else ''}")
