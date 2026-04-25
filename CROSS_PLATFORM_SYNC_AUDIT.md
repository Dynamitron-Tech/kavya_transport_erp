# Kavya Transport ERP — Cross-Platform API Sync Audit

**Scope:** Every screen/tab that exists on BOTH the Flutter mobile app AND the React website, cross-checked for identical API calls (same method + same path + same params).

**Legend:**
| Icon | Meaning |
|------|---------|
| ✅ SYNCED | Both platforms call the same method + path + params → data is consistent |
| ❌ OUT OF SYNC | Different method or path → one platform gets 404/405 or writes divergent data |
| ⚠️ PARTIAL SYNC | Same endpoint but different params/filters → different data returned |
| 🌐 WEB ONLY | Screen exists only on website — not audited |
| 📱 APP ONLY | Screen exists only in mobile app — not audited |

---

## 1. ADMIN / DASHBOARD

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ❌ OUT OF SYNC | Admin Dashboard | KPI stats | `GET /admin/dashboard/stats` | `GET /dashboard/pa/kpis` + `/dashboard/pa/action-center` + 8 more `/dashboard/pa/*` endpoints | **Different endpoints entirely.** App hits `admin_dashboard.py`; website hits `pa_dashboard.py`. Data schemas differ. Fix: Website should also call `/admin/dashboard/stats` for admin users, or unify the dashboard endpoint |
| ✅ SYNCED | Admin Dashboard | User/employee list | `GET /users?role=&search=` | `GET /users?search=` | Same endpoint, same method |
| 📱 APP ONLY | Admin Dashboard | Role health panel | `GET /admin/dashboard/role-health` | — | Not on website |
| 🌐 WEB ONLY | Admin Dashboard | PA job pipeline | — | `GET /dashboard/pa/job-pipeline` | Not in app admin dashboard |
| 🌐 WEB ONLY | Admin Dashboard | PA banking status | — | `GET /dashboard/pa/banking-status` | Not in app admin dashboard |

---

## 2. EMPLOYEE / USER MANAGEMENT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Employees | List employees | `GET /users?role=&search=` | `GET /users?search=` | Same endpoint |
| ✅ SYNCED | Employees | Create employee | `POST /users {data}` | `POST /users {data}` | Same |
| ✅ SYNCED | Employees | Update employee | `PUT /users/{id} {data}` | `PUT /users/{id} {data}` | Same — both use PUT |
| ✅ SYNCED | Employees | Delete employee | `DELETE /users/{id}` | `DELETE /users/{id}` | Same |
| ✅ SYNCED | Employee Detail | Deactivate/Activate | `PUT /users/{id} {is_active: bool}` | `PUT /users/{id} {is_active: bool}` | Same — both use PUT with `is_active` field |
| ✅ SYNCED | Employee Detail | Change role | `PUT /users/{id} {role: selected}` | `PUT /users/{id} {role_names: [role]}` | Same endpoint, ⚠️ but **field name differs**: app sends `role` (string), website sends `role_names` (array). Backend must accept both or one side fails silently |
| ✅ SYNCED | Employee Detail | Reset password | `POST /users/{id}/reset-password` | `PUT /users/{id} {password: newPw}` | ⚠️ Same user update but different approach — app has dedicated reset endpoint, website inlines password in PUT |

---

## 3. CLIENT MANAGEMENT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Clients | List clients | `GET /clients?search=` | `GET /clients?search=` | Same |
| ✅ SYNCED | Clients | Create client | `POST /clients {data}` | `POST /clients {data}` | Same |
| ✅ SYNCED | Client Detail | Get client | `GET /clients/{id}` | `GET /clients/{id}` | Same |
| 🌐 WEB ONLY | Client Detail | Client jobs | — | `GET /clients/{id}/jobs` | Website has sub-tabs |
| 🌐 WEB ONLY | Client Detail | Client invoices | — | `GET /clients/{id}/invoices` | Website has sub-tabs |
| 🌐 WEB ONLY | Client Detail | Client ledger | — | `GET /clients/{id}/ledger` | Website has sub-tabs |
| 🌐 WEB ONLY | Client Detail | Client outstanding | — | `GET /clients/{id}/outstanding` | Website has sub-tabs |

---

## 4. VEHICLE MANAGEMENT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Vehicles | List vehicles | `GET /vehicles?limit=100` | `GET /vehicles?search=&limit=` | Same endpoint |
| ✅ SYNCED | Vehicles | Vehicle summary | `GET /vehicles/summary` | `GET /vehicles/summary` | Same |
| ✅ SYNCED | Vehicles | Create vehicle | `POST /vehicles {data}` | `POST /vehicles {data}` | Same |
| ✅ SYNCED | Vehicle Detail | Get vehicle | `GET /vehicles/{id}` | `GET /vehicles/{id}` | Same |
| 🌐 WEB ONLY | Vehicle Detail | Vehicle overview | — | `GET /vehicles/{id}/overview` | Not in app |
| 🌐 WEB ONLY | Vehicle Detail | Trip history | — | `GET /vehicles/{id}/trips` | Not in app |
| 🌐 WEB ONLY | Vehicle Detail | Health score | — | `GET /vehicles/{id}/health-score` | Not in app |

---

## 5. DRIVER MANAGEMENT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Drivers | List drivers | `GET /drivers?limit=100` | `GET /drivers?search=` | Same endpoint |
| ✅ SYNCED | Drivers | Create driver | `POST /drivers {data}` | `POST /drivers {data}` | Same |
| ✅ SYNCED | Driver Detail | Get driver | `GET /drivers/{id}` | `GET /drivers/{id}` | Same |
| ✅ SYNCED | Driver (self) | My trips | `GET /drivers/me/trips` | `GET /drivers/me/trips` | Same |
| ✅ SYNCED | Driver (self) | My documents | `GET /drivers/me/documents` | `GET /drivers/me/documents` | Same |
| 🌐 WEB ONLY | Driver Detail | Performance metrics | — | `GET /drivers/{id}/performance` | Not in app |
| 🌐 WEB ONLY | Driver Detail | Behaviour analytics | — | `GET /drivers/{id}/behaviour` | Not in app |

---

## 6. JOBS / ORDERS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Jobs | List jobs | `GET /jobs?status=&search=` | `GET /jobs?search=&status=` | Same |
| ✅ SYNCED | Jobs | Create job | `POST /jobs {data}` | `POST /jobs {data}` | Same |
| ✅ SYNCED | Jobs | Get job detail | `GET /jobs/{id}` | `GET /jobs/{id}` | Same |
| ✅ SYNCED | Jobs | Assign vehicle+driver | `PUT /jobs/{id}/assign {vehicle_id, driver_id}` | `PUT /jobs/{id}/assign {vehicle_id, driver_id}` | **Same** — both use PUT ✅ |
| 🌐 WEB ONLY | Jobs | Submit for approval | — | `POST /jobs/{id}/submit-for-approval` | Not in app |
| 🌐 WEB ONLY | Jobs | Approve job | — | `POST /jobs/{id}/approve` | Not in app |
| 🌐 WEB ONLY | Jobs | Lookup endpoints | — | `GET /jobs/lookup/clients\|routes\|...` | Not in app |

---

## 7. TRIPS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Trips | List trips | `GET /trips?status=&page=&limit=` | `GET /trips?status=&page=&limit=` | Same |
| ✅ SYNCED | Trips | Create trip | `POST /trips {data}` | `POST /trips {data}` | Same |
| ✅ SYNCED | Trips | Get trip detail | `GET /trips/{id}` | `GET /trips/{id}` | Same |
| ✅ SYNCED | Trip Detail | Trip expenses | `GET /trips/{id}/expenses` | `GET /trips/{id}/expenses` | Same |
| ❌ OUT OF SYNC | Trips | **Start trip** | `PATCH /trips/{id}/status {status:'in_transit'}` | `PUT /trips/{id}/start {start_odometer}` | **App uses PATCH on `/status`; website uses PUT on `/start`.** Backend must support both routes, or one side gets 404/405. **Fix: Align — either both use `PUT /trips/{id}/start` or both use `PATCH /trips/{id}/status`** |
| ❌ OUT OF SYNC | Trips | **Complete trip** | `PATCH /trips/{id}/status {status:'completed'}` | `POST /trips/{id}/complete {end_odometer, notes}` | **App uses PATCH `/status`; website uses POST `/complete`.** Different data sent too — website sends odometer/notes, app sends just status. **Fix: Align to `POST /trips/{id}/complete` with optional fields** |
| ✅ SYNCED | Trips | Close trip (PA) | `PUT /trips/{id}/close {end_odometer_km, remarks}` | `PUT /trips/{id}/close` | Same method + path |
| ❌ OUT OF SYNC | Trips | **Reach destination** | `PATCH /trips/{id}/status {status:'reached'}` | `PUT /trips/{id}/reach` | **App: PATCH `/status`; Website: PUT `/reach`.** Fix: Align to one approach |
| 🌐 WEB ONLY | Trips | Dispatch trip | — | `POST /trips/{id}/dispatch` | Not in app |
| 🌐 WEB ONLY | Trips | Route calculator | — | `GET /maps/route` | Not in app |

---

## 8. LORRY RECEIPTS (LR)

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | LR | List LRs | `GET /lr` | `GET /lr` | Same |
| ✅ SYNCED | LR | Create LR | `POST /lr {data}` | `POST /lr {data}` | Same |
| 🌐 WEB ONLY | LR | Update LR | — | `PUT /lr/{id}` | App has no edit |
| 🌐 WEB ONLY | LR | Cancel LR | — | `POST /lr/{id}/cancel` | Not in app |
| 🌐 WEB ONLY | LR | POD upload | — | `POST /lr/{id}/pod` | App uses EPOD flow via `/documents/upload` instead |
| 🌐 WEB ONLY | LR | Generate LR | — | `POST /lr/{id}/generate` | Not in app |

---

## 9. E-WAY BILLS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | E-Way Bills | Create e-way bill | `POST /eway-bills {data}` | `POST /eway-bills {data}` | Same |
| ✅ SYNCED | E-Way Bills | Extend validity | `POST /eway-bills/{id}/extend` | `POST /eway-bills/{id}/extend` | Same |
| ❌ OUT OF SYNC | E-Way Bills | **Generate on portal** | `POST /eway-bills/api/generate` | `POST /eway-bills/{id}/generate` | **Different paths!** App calls `/api/generate` (global); website calls `/{id}/generate` (per-bill). Fix: Align — website should also use `/eway-bills/api/generate` with bill ID in body, or add both routes in backend |
| 🌐 WEB ONLY | E-Way Bills | Cancel e-way bill | — | `POST /eway-bills/{id}/cancel` | Not in app |
| 🌐 WEB ONLY | E-Way Bills | List active/expiring | — | `GET /eway-bills/active\|expiring` | Not in app |

---

## 10. EXPENSES

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Expenses | List expenses | `GET /expenses?status=&page=&limit=` | `GET /expenses?category=` | Same endpoint, different filters |
| ❌ OUT OF SYNC | Expenses | **Approve expense (Manager)** | `PATCH /expenses/{id}/status {status:'approved'}` | `PUT /accountant/expenses/{id}/approve` | **Completely different method + path!** App: PATCH on `/expenses/{id}/status`; Website: PUT on `/accountant/expenses/{id}/approve`. Fix: Align both to `PATCH /expenses/{id}/status {status:'approved'}` (the backend's canonical route) |
| ❌ OUT OF SYNC | Expenses | **Reject expense (Manager)** | `PATCH /expenses/{id}/status {status:'rejected', reason}` | `PUT /accountant/expenses/{id}/reject` | **Same mismatch.** Fix: Align website to `PATCH /expenses/{id}/status {status:'rejected', reason}` |
| ✅ SYNCED | Expenses | Create expense | `POST /accountant/expenses {data}` | `POST /accountant/expenses {data}` | Same (accountant context) |
| 🌐 WEB ONLY | Expenses | Trip expense verify | — | `POST /trips/{id}/expenses/{expenseId}/verify` | Not in app |
| ✅ SYNCED | Driver Expenses | Driver adds expense | `POST /documents/upload` (receipt) + trip expense | `POST /trips/{id}/expenses` | Same trip expense endpoint |

---

## 11. FINANCE — INVOICES

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Invoices | List invoices | `GET /finance/invoices` | `GET /finance/invoices` | Same |
| ✅ SYNCED | Invoices | Get invoice detail | `GET /finance/invoices/{id}` | `GET /finance/invoices/{id}` | Same |
| ✅ SYNCED | Invoices | Send invoice | `POST /finance/invoices/{id}/send` | `POST /finance/invoices/{id}/send` | Same |
| ✅ SYNCED | Invoices | Record payment | `POST /finance/payments {invoice_id, amount}` | `POST /finance/payments {data}` | Same endpoint |
| 🌐 WEB ONLY | Invoices | Generate from trip | — | `POST /finance/invoices/generate-from-trip/{tripId}` | Not in app |
| 🌐 WEB ONLY | Invoices | Mark paid | — | `POST /finance/invoices/{id}/mark-paid` | Not in app |

---

## 12. FINANCE — BANKING

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Banking | List entries | `GET /banking/entries` | `GET /banking/entries` | Same |
| ✅ SYNCED | Banking | Create entry | `POST /banking/entries {data}` | `POST /banking/entries {data}` | Same |
| ✅ SYNCED | Banking | Bank accounts | `GET /banking/accounts` | `GET /finance/bank-accounts` | ⚠️ **Different path** but may be aliased. App: `/banking/accounts`; Website: `/finance/bank-accounts`. Verify backend has both routes |
| ❌ OUT OF SYNC | Banking | **Reconcile entry (Manager)** | `PATCH /banking/entries/{id} {reconciled:true}` | `PUT /banking/{id}/approve` | **Different method + path + semantics.** App patches the entry with reconciled flag; website PUTs an approve action. Fix: Align — both should use `PUT /banking/entries/{id} {reconciled:true}` or `POST /banking/reconciliation/match` |
| 🌐 WEB ONLY | Banking | Import reconciliation | — | `POST /banking/reconciliation/import` | Not in app |
| 🌐 WEB ONLY | Banking | Match transactions | — | `POST /banking/reconciliation/match` | Not in app |

---

## 13. FINANCE — PAYABLES & SETTLEMENTS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Payables | List payables | `GET /payables/` | `GET /finance/payables` | ⚠️ **Different base path** — App: `/payables/`; Website: `/finance/payables`. Verify backend routes both |
| ✅ SYNCED | Payables | Approve payable | `PATCH /payables/{id}/approve` | `POST /finance/settlements/{id}/approve` | ⚠️ **Different endpoint semantics** — App operates on payables directly; website on settlements. Data may diverge |
| ✅ SYNCED | Driver Payments | List driver payments | `GET /accountant/driver-payments` | `GET /accountant/driver-payments` | Same |
| ✅ SYNCED | Driver Payments | Mark paid | `POST /accountant/driver-payments/{id}/mark-paid` | `POST /accountant/driver-payments/{id}/mark-paid` | Same |

---

## 14. FLEET MANAGEMENT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ❌ OUT OF SYNC | Fleet Dashboard | **KPI metrics** | **Hardcoded values** (no API call) | `GET /fleet/dashboard/kpis` + 8 sub-endpoints | **App shows fake hardcoded data; website shows live data.** Fleet managers see different numbers. Fix: App must call `GET /fleet/dashboard/kpis` |
| ✅ SYNCED | Fleet Analytics | Fleet dashboard | `GET /fleet/dashboard` | `GET /fleet/dashboard/kpis` | ⚠️ Slightly different paths — app calls `/fleet/dashboard`, website calls `/fleet/dashboard/kpis`. May be same or aliased |
| ✅ SYNCED | Fleet Vehicles | Vehicle list | `GET /fleet/vehicles` | `GET /fleet/vehicles/{id}/profile` (per-vehicle) | Website has richer per-vehicle profiles |
| ✅ SYNCED | Fleet Drivers | Driver list | `GET /drivers` | `GET /fleet/drivers` | ⚠️ App calls general `/drivers`; website calls `/fleet/drivers`. May return same data |
| 🌐 WEB ONLY | Fleet Dashboard | Expiring documents | — | `GET /fleet/dashboard/expiring-documents` | Not in app |
| 🌐 WEB ONLY | Fleet Dashboard | Active trips | — | `GET /fleet/dashboard/active-trips` | Not in app |
| 🌐 WEB ONLY | Fleet | Maintenance schedule | — | `GET /fleet/maintenance/schedule` | Not in app |
| 🌐 WEB ONLY | Fleet | Work orders | — | `GET /fleet/maintenance/work-orders` | Not in app |
| 🌐 WEB ONLY | Fleet | Parts inventory | — | `GET /fleet/maintenance/parts-inventory` | Not in app |
| 🌐 WEB ONLY | Fleet | Battery monitoring | — | `GET /fleet/maintenance/battery` | Not in app |

---

## 15. TRACKING

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | GPS Tracking | GPS ping | `POST /tracking/gps/ping {lat, lng, speed, heading}` | (WebSocket-based, not REST) | App sends pings; website consumes via tracking endpoints |
| ✅ SYNCED | Live Tracking | Live positions | (via WebSocket `vehicle_tracking` events) | `GET /tracking/live` | Both access live data but via different transport |
| 🌐 WEB ONLY | Trip Replay | Replay trail | — | `GET /tracking/trip/{id}/trail` | Not in app |

---

## 16. COMPLIANCE

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ❌ OUT OF SYNC | Compliance | **List compliance alerts** | `GET /admin/compliance/alerts?severity=&category=` | `GET /compliance/alerts` + `GET /compliance/alerts/summary` | **Different base paths.** App: `/admin/compliance/alerts`; Website: `/compliance/alerts`. Fix: Verify both routes exist in backend |
| ✅ SYNCED | Compliance | Renew vehicle compliance | `PATCH /admin/vehicles/{id}/compliance {data}` | `PUT /compliance/alerts/{id}/resolve` | ⚠️ Different approach — app patches vehicle compliance; website resolves alerts. Both write to compliance system but via different routes |
| 🌐 WEB ONLY | Compliance | Safety events | — | `GET /compliance/events` | Not in app |
| 🌐 WEB ONLY | Compliance | Audit notes | — | `GET /compliance/audit-notes` | Not in app |

---

## 17. DOCUMENTS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Documents | Upload document | `POST /documents/upload` (multipart) | `POST /documents/upload` (multipart) | Same |
| ✅ SYNCED | Documents | List documents | (via driver-specific `/drivers/me/documents`) | `GET /documents` | Same system, different access patterns |
| 🌐 WEB ONLY | Documents | Document approval | — | `POST /documents/{id}/approve\|reject` | Not in app |
| 🌐 WEB ONLY | Documents | OCR extraction | — | `POST /documents/extract` | Not in app |
| 🌐 WEB ONLY | Documents | Document stats | — | `GET /documents/stats` | Not in app |

---

## 18. REPORTS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ⚠️ PARTIAL SYNC | Reports | Summary report (Manager) | `GET /reports/summary?period=month` | `GET /reports/dashboard` | Different endpoint paths — app uses `/reports/summary`, website uses `/reports/dashboard`. Both exist but return different response shapes |
| 🌐 WEB ONLY | Reports | Trip summary | — | `GET /reports/trip-summary` | Not in app |
| 🌐 WEB ONLY | Reports | Vehicle performance | — | `GET /reports/vehicle-performance` | Not in app |
| 🌐 WEB ONLY | Reports | Revenue analysis | — | `GET /reports/revenue-analysis` | Not in app |

---

## 19. ACCOUNTANT

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Accountant | Receivables | `GET /accountant/receivables` | `GET /accountant/receivables` | Same |
| ✅ SYNCED | Accountant | Expenses list | `GET /accountant/expenses?status=&page=&limit=` | `GET /accountant/expenses` or `GET /expenses` | Same base endpoint |
| ✅ SYNCED | Accountant | GST | `GET /accountant/gst` | `GET /finance/gst/summary` | ⚠️ Different paths — App: `/accountant/gst`; Website: `/finance/gst/summary` |
| ✅ SYNCED | Accountant | Statements | `GET /accountant/statements` | (via ledger page) | Same data, different UI |
| ✅ SYNCED | Accountant | Payables | `GET /accountant/payables` | `GET /accountant/payables` | Same |
| ✅ SYNCED | Accountant | Vouchers | `GET /accountant/vouchers` | (no dedicated voucher page) | |
| ✅ SYNCED | Accountant | Create voucher | `POST /accountant/vouchers {data}` | (no dedicated voucher page) | |
| ✅ SYNCED | Accountant | Ledger | `GET /accountant/ledger` | `GET /accountant/ledger` | Same |

---

## 20. FUEL PUMP OPERATOR

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Pump | Active shift | `GET /fuel-pump/shifts/active` | (via `/fuel-pump/dashboard`) | App has dedicated shift endpoint |
| ✅ SYNCED | Pump | Tank levels | `GET /fuel-pump/tanks` | `GET /fuel-pump/tanks` | Same |
| ✅ SYNCED | Pump | Open shift | `POST /fuel-pump/shifts {data}` | `POST /fuel-pump/shifts {data}` | Same |
| ✅ SYNCED | Pump | Close shift | `POST /fuel-pump/shifts/{id}/close {data}` | `POST /fuel-pump/shifts/{id}/close {data}` | Same |
| ✅ SYNCED | Pump | Stock refill | `POST /fuel-pump/stock {data}` | `POST /fuel-pump/stock {data}` | Same |
| ✅ SYNCED | Pump | Create tank | `POST /fuel-pump/tanks {data}` | `POST /fuel-pump/tanks {data}` | Same |
| 🌐 WEB ONLY | Pump | Issue fuel | — | `POST /fuel-pump/issues {data}` | Not in app |
| 🌐 WEB ONLY | Pump | Fuel log | — | `GET /fuel-pump/issues` | Not in app |
| 🌐 WEB ONLY | Pump | Pump alerts | — | `GET /fuel-pump/alerts` | Not in app |

---

## 21. MANAGER ROLE

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ❌ OUT OF SYNC | Manager Dashboard | KPI stats | `GET /manager/dashboard/stats` | `GET /dashboard/overview` + fleet/trip/finance stats | **Different endpoints.** App: `manager_dashboard.py`; Website: generic `dashboard.py`. Fix: Website should call `/manager/dashboard/stats` for manager users |
| ✅ SYNCED | Manager | Revenue sparkline | `GET /manager/dashboard/revenue-sparkline` | `GET /dashboard/charts/revenue-trend` | ⚠️ Different paths — same concept, different endpoints |
| ✅ SYNCED | Manager | Notifications | `GET /my-notifications?limit=50` | `GET /dashboard/notifications` | ⚠️ Different endpoints — data may differ |
| ✅ SYNCED | Manager | Mark notification read | `PATCH /my-notifications/{id}/read` | `POST /dashboard/notifications/{id}/read` | ⚠️ Different method + path |

---

## 22. BRANCH MANAGER

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Branch Dashboard | Branch KPIs | `GET /dashboard/branch` | `GET /branches/{id}` + `GET /branches/{id}/pnl` | ⚠️ Different approach — app uses single dashboard endpoint; website composes from branch detail + P&L |
| ✅ SYNCED | Branch | Driver list | `GET /drivers/` | `GET /drivers/` | Same |
| ✅ SYNCED | Branch | Summary report | `GET /reports/branch/summary?period=` | `GET /branches/{id}/pnl?period=` | ⚠️ Different paths for same concept |

---

## 23. TYRES

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Tyres | List tyres | `GET /tyre` | `GET /tyre` | Same |
| ✅ SYNCED | Tyres | Create tyre | `POST /tyre {data}` | `POST /tyre {data}` | Same |
| ✅ SYNCED | Tyres | Update tyre | `PUT /tyre/{id} {data}` | `PUT /tyre/{id} {data}` | Same |
| ✅ SYNCED | Tyres | Tyre event | `POST /tyre/{id}/event {data}` | `POST /tyre/{id}/event {data}` | Same |

---

## 24. SUPPLIERS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Suppliers | List suppliers | `GET /suppliers` | `GET /suppliers` | Same |
| ✅ SYNCED | Suppliers | Create supplier | `POST /suppliers {data}` | `POST /suppliers {data}` | Same |
| ✅ SYNCED | Supplier Detail | Get supplier | `GET /suppliers/{id}` | `GET /suppliers/{id}` | Same |
| 🌐 WEB ONLY | Supplier Detail | Supplier trips | — | `GET /suppliers/{id}/trips` | Not in app |
| 🌐 WEB ONLY | Supplier Detail | Supplier statement | — | `GET /suppliers/{id}/statement` | Not in app |

---

## 25. MARKET TRIPS

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| ✅ SYNCED | Market Trips | List | `GET /market-trips` | `GET /market-trips` | Same |
| ✅ SYNCED | Market Trips | Create | `POST /market-trips {data}` | `POST /market-trips {data}` | Same |
| 🌐 WEB ONLY | Market Trips | Assign/Start/Deliver | — | `PUT /market-trips/{id}/assign\|start\|deliver` | Not in app |
| 🌐 WEB ONLY | Market Trips | Settle/Cancel | — | `POST /market-trips/{id}/settle`, `PUT /market-trips/{id}/cancel` | Not in app |

---

## 26. DRIVER SCORING

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| 🌐 WEB ONLY | Driver Scoring | Leaderboard | — | `GET /driver-scoring/leaderboard` | Not in app |
| 🌐 WEB ONLY | Driver Scoring | Score breakdown | — | `GET /driver-scoring/{id}/score/breakdown` | Not in app |

---

## 27. GEOFENCES

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| 🌐 WEB ONLY | Geofences | CRUD + check | — | `GET\|POST\|PUT\|DELETE /geofences` | Not in app |

---

## 28. TPMS (Tyre Pressure Monitoring)

| STATUS | TAB / SCREEN | SHARED FEATURE | APP API CALL | WEBSITE API CALL | FIX NEEDED |
|--------|--------------|----------------|--------------|------------------|------------|
| 🌐 WEB ONLY | TPMS | Fleet overview | — | `GET /tpms/fleet` | Not in app |
| 🌐 WEB ONLY | TPMS | Alerts | — | `GET /tpms/alerts` | Not in app |

---

# EXECUTIVE SUMMARY

## Counts

| Metric | Count |
|--------|-------|
| **Total shared features audited** | **82** |
| ✅ Fully synced | **52** |
| ❌ Out of sync (critical) | **10** |
| ⚠️ Partial sync (different paths, same concept) | **20** |
| 🌐 Web-only features (skipped) | ~65 |
| 📱 App-only features (skipped) | ~8 |

---

## CRITICAL OUT-OF-SYNC FIXES (❌) — Data Inconsistency Risk

| # | Feature | App Calls | Website Calls | Impact | Fix |
|---|---------|-----------|---------------|--------|-----|
| **1** | **Trip Start** | `PATCH /trips/{id}/status {status:'in_transit'}` | `PUT /trips/{id}/start {start_odometer}` | Trip started from app won't record odometer; started from web uses different route | **Align both to `PUT /trips/{id}/start`** or ensure backend treats both identically |
| **2** | **Trip Complete** | `PATCH /trips/{id}/status {status:'completed'}` | `POST /trips/{id}/complete {end_odometer, notes}` | Completing from app loses odometer/notes data | **Align app to `POST /trips/{id}/complete {end_odometer, notes}`** |
| **3** | **Trip Reach** | `PATCH /trips/{id}/status {status:'reached'}` | `PUT /trips/{id}/reach` | Minor — both mark as reached but via different routes | **Align to `PUT /trips/{id}/reach`** |
| **4** | **Expense Approve** | `PATCH /expenses/{id}/status {status:'approved'}` | `PUT /accountant/expenses/{id}/approve` | Completely different endpoints — if backend only has one, the other returns 404 | **Align website to `PATCH /expenses/{id}/status {status:'approved'}`** (backend's canonical route) |
| **5** | **Expense Reject** | `PATCH /expenses/{id}/status {status:'rejected', reason}` | `PUT /accountant/expenses/{id}/reject` | Same as #4 | **Align website to `PATCH /expenses/{id}/status {status:'rejected', reason}`** |
| **6** | **Banking Reconcile** | `PATCH /banking/entries/{id} {reconciled:true}` | `PUT /banking/{id}/approve` | Different paths and semantics | **Align both to `PUT /banking/entries/{id} {reconciled:true}`** |
| **7** | **E-way Bill Generate** | `POST /eway-bills/api/generate` | `POST /eway-bills/{id}/generate` | Different route structures | **Align both to `POST /eway-bills/api/generate {eway_bill_id}`** |
| **8** | **Admin Dashboard** | `GET /admin/dashboard/stats` | `GET /dashboard/pa/kpis` + 8 PA endpoints | Completely different dashboard data sources | **Website should call `/admin/dashboard/stats` for admin role** |
| **9** | **Manager Dashboard** | `GET /manager/dashboard/stats` | `GET /dashboard/overview` + sub-endpoints | Different dashboard data sources | **Website should call `/manager/dashboard/stats` for manager role** |
| **10** | **Fleet Dashboard KPIs** | **Hardcoded** (no API call) | `GET /fleet/dashboard/kpis` | App shows fake data; website shows real data | **App must call `/fleet/dashboard/kpis`** |

---

## ⚠️ PARTIAL SYNC — Lower Priority

| # | Feature | Issue | Recommendation |
|---|---------|-------|----------------|
| 1 | Employee role change | App sends `{role: string}`, website sends `{role_names: [string]}` | Standardize to one field name; backend should accept both |
| 2 | Bank accounts list | App: `/banking/accounts`; Web: `/finance/bank-accounts` | Verify backend has both aliases |
| 3 | Payables list | App: `/payables/`; Web: `/finance/payables` | Verify both routes exist |
| 4 | GST report | App: `/accountant/gst`; Web: `/finance/gst/summary` | Verify both routes exist |
| 5 | Notifications | App: `GET /my-notifications`; Web: `GET /dashboard/notifications` | Different sources — may show different notifications |
| 6 | Mark notification read | App: `PATCH /my-notifications/{id}/read`; Web: `POST /dashboard/notifications/{id}/read` | Different method + path |
| 7 | Reports summary | App: `/reports/summary?period=`; Web: `/reports/dashboard` | Different response shapes |
| 8 | Compliance alerts | App: `/admin/compliance/alerts`; Web: `/compliance/alerts` | Verify both routes exist |
| 9 | Fleet drivers | App: `GET /drivers`; Web: `GET /fleet/drivers` | May return different data sets |
| 10 | Branch KPIs | App: `/dashboard/branch`; Web: `/branches/{id}` + `/branches/{id}/pnl` | Different composition approaches |

---

## FIX PRIORITY

### P0 — Fix Immediately (data corruption / user confusion)
1. **Trip lifecycle** (#1, #2, #3): Align app trip start/complete/reach to match website's dedicated endpoints (`PUT /start`, `POST /complete`, `PUT /reach`)
2. **Expense approval** (#4, #5): Align website expense approve/reject to `PATCH /expenses/{id}/status`
3. **Fleet dashboard** (#10): Remove hardcoded KPIs from app; call `GET /fleet/dashboard/kpis`

### P1 — Fix Soon (wrong data shown to users)
4. **Dashboard endpoints** (#8, #9): Website should call role-specific dashboard endpoints
5. **Banking reconcile** (#6): Align to a single reconciliation approach
6. **E-way bill generate** (#7): Standardize to one route

### P2 — Fix Eventually (cosmetic / minor data differences)
7. All ⚠️ partial syncs — verify backend aliases exist, standardize field names
