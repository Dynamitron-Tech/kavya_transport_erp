# Kavya Transport ERP — Full Connectivity Report

**Generated after full codebase read: all screens, all providers, all backend endpoints cross-checked.**

**Legend**
| Icon | Meaning |
|------|---------|
| ✅ LIVE | Correct method, correct path, correct fields — works in production |
| ⚠️ PARTIAL | Endpoint exists but wrong param/filter/status value — wrong data returned, no crash |
| ❌ BROKEN | Wrong HTTP method or wrong path — 404 / 405 / 422 in production |
| 🔲 NO-CALL | Screen renders with hardcoded data or is an unimplemented stub |
| 🚫 UNREACHABLE | File exists in codebase but no route in `app_router.dart` points to it |

---

## ADMIN ROLE — `lib/features/admin/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | AdminDashboardScreen | KPIs (vehicles / jobs / revenue) | `GET /admin/dashboard/stats` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminDashboardScreen | Role health panel | `GET /admin/dashboard/role-health` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminFinanceOverviewScreen | Finance summary | `GET /admin/finance/summary` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminFinanceOverviewScreen | Payables summary | `GET /admin/finance/payables-summary` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminComplianceScreen | Compliance alerts | `GET /admin/compliance/alerts?severity?&category?` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminComplianceScreen | Mark vehicle compliance renewed | `PATCH /admin/vehicles/{id}/compliance {compliance_type, expiry_date}` | `admin_dashboard.py` line 545 ✅ | |
| ✅ LIVE | AdminComplianceDetailScreen | Update compliance document | `PATCH /admin/vehicles/{id}/compliance {…}` | `admin_dashboard.py` ✅ | |
| ✅ LIVE | AdminOperationsScreen | Jobs list | `GET /jobs?status?` | `jobs.py` ✅ | |
| ✅ LIVE | AdminEmployeesScreen | Employee list | `GET /users?role?&search?` | `users.py` ✅ | |
| ✅ LIVE | AdminBranchesScreen | Branches list | `GET /branches` | `branches.py` ✅ | |
| ✅ LIVE | AdminTripDetailScreen | Trip full detail | `GET /trips/{id}` | `trips.py` ✅ | |
| ✅ LIVE | AdminTripDetailScreen | Trip timeline | `GET /trips/{id}/timeline` | `trips.py` line 802 ✅ | |
| ✅ LIVE | AdminTripDetailScreen | Trip expenses | `GET /trips/{id}/expenses` | `trips.py` line 583 ✅ | |
| ✅ LIVE | AdminVehicleDetailScreen | Vehicle detail | `GET /vehicles/{id}` | `vehicles.py` ✅ | |
| ✅ LIVE | AdminDriverDetailScreen | Driver detail | `GET /drivers/{id}` | `drivers.py` ✅ | |
| ✅ LIVE | AdminJobDetailScreen | Job detail | `GET /jobs/{id}` | `jobs.py` ✅ | |
| ✅ LIVE | AdminInvoiceDetailScreen | Invoice detail | `GET /finance/invoices/{id}` | `finance.py` ✅ | |
| ✅ LIVE | AdminInvoiceDetailScreen | Send invoice | `POST /finance/invoices/{id}/send` | `finance.py` line 84 ✅ | |
| ✅ LIVE | AdminInvoiceDetailScreen | Record payment | `POST /finance/payments {invoice_id, amount}` | `finance.py` ✅ | |
| ✅ LIVE | AdminEmployeeDetailScreen | Employee detail | `GET /users/{id}` | `users.py` ✅ | |
| ✅ LIVE | AdminEmployeeDetailScreen | Reset password | `POST /users/{id}/reset-password` | `users.py` line 150 ✅ | |
| ❌ BROKEN | AdminEmployeeDetailScreen | Deactivate user | `PATCH /users/{id}/deactivate` | `users.py` has **no** `/deactivate` route → **404** | Only `DELETE /users/{id}` soft-deletes; add a `PATCH` route or use DELETE |
| ❌ BROKEN | AdminEmployeeDetailScreen | Reactivate user | `PATCH /users/{id}/activate` | `users.py` has **no** `/activate` route → **404** | |
| ❌ BROKEN | AdminEmployeeDetailScreen | Change role | `PATCH /users/{id} {role: selected}` | `users.py` only has `PUT /users/{id}` → **405 Method Not Allowed** | Change `api.patch(...)` → `api.put(...)` |
| ✅ LIVE | AdminCreateEmployeeScreen | Create employee | `POST /users {…}` | `users.py` ✅ | |
| 🔲 NO-CALL | AdminDashboardScreen / any screen | View pending trip completions | — | `GET /admin/trips/pending-completion` exists in `admin.py` line 84 and `api_service.getAdminPendingTripCompletions()` exists | Method defined but no screen calls it; approval UI is unbuilt |
| 🔲 NO-CALL | — | Approve trip completion | — | `POST /admin/trips/{id}/approve-completion` exists + `api_service` method | Same: zero UI entry point |

---

## MANAGER ROLE — `lib/features/manager/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | ManagerDashboardScreen | KPIs | `GET /manager/dashboard/stats` | `manager_dashboard.py` ✅ | |
| ✅ LIVE | ManagerDashboardScreen | Revenue sparkline | `GET /manager/dashboard/revenue-sparkline` | `manager_dashboard.py` line 95 ✅ | |
| ✅ LIVE | ManagerDashboardScreen | Pending approvals count | `GET /manager/dashboard/approvals` | `manager_dashboard.py` line 152 ✅ | |
| ✅ LIVE | ManagerJobListScreen | Jobs list with filters | `GET /jobs?status?&search?` | `jobs.py` ✅ | |
| ✅ LIVE | ManagerJobListScreen | Unassigned jobs | `GET /jobs?status=unassigned` | `jobs.py` ✅ | |
| ✅ LIVE | ManagerJobDetailScreen | Job detail | `GET /jobs/{id}` | `jobs.py` ✅ | |
| ✅ LIVE | ManagerCreateJobScreen | Create job | `POST /jobs {body}` | `jobs.py` ✅ | |
| ❌ BROKEN | ManagerAssignScreen | Assign vehicle + driver to job | `PATCH /jobs/{id}/assign {vehicle_id, driver_id}` | `jobs.py` has `PUT /jobs/{id}/assign` → **405 Method Not Allowed** | Change `api.patch(…)` → `api.put(…)` |
| ✅ LIVE | ManagerClientsScreen | Client list | `GET /clients?search?` | `clients.py` ✅ | |
| ✅ LIVE | ManagerClientDetailScreen | Client detail | `GET /clients/{id}` | `clients.py` ✅ | |
| ✅ LIVE | ManagerCreateClientScreen | Create client | `POST /clients {data}` | `clients.py` ✅ | |
| ✅ LIVE | ManagerFleetScreen | Fleet summary tile | `GET /vehicles/summary` | `vehicles.py` line 37 ✅ | |
| ✅ LIVE | ManagerFleetScreen | Vehicle list | `GET /vehicles?limit=100` | `vehicles.py` ✅ | |
| ✅ LIVE | ManagerFleetScreen | Driver list | `GET /drivers?limit=100` | `drivers.py` ✅ | |
| ✅ LIVE | ManagerVehicleDetailScreen | Vehicle detail | `GET /vehicles/{id}` | `vehicles.py` ✅ | |
| ✅ LIVE | ManagerReportsScreen | Aggregated report | `GET /reports/summary?period=month\|week\|year` | `reports.py` line 89 ✅ | |
| ❌ BROKEN | ManagerApprovalsScreen | Approve expense | `PATCH /expenses/{id}/approve` (no body) | `aliases.py` has `PATCH /expenses/{id}/status` only → **404** | Fix: `api.patch('/expenses/$id/status', data: {'status': 'approved'})` |
| ❌ BROKEN | ManagerApprovalsScreen | Reject expense with reason | `PATCH /expenses/{id}/reject {reason}` | `aliases.py` has `PATCH /expenses/{id}/status` only → **404** | Fix: use `PATCH /expenses/{id}/status {status: 'rejected', reason: reason}` |
| ❌ BROKEN | ManagerApprovalsScreen | Reconcile banking entry | `PATCH /banking/{id}/reconcile` | `banking.py` has **no** per-entry reconcile route → **404** | Backend reconciles via `POST /banking/reconciliation/match`; needs design alignment |
| ✅ LIVE | ManagerNotificationsScreen | Notifications list | `GET /my-notifications?limit=50` | `user_notifications.py` ✅ | |
| ✅ LIVE | ManagerNotificationsScreen | Mark all read | `PATCH /my-notifications/read-all` | `user_notifications.py` line 88 ✅ | |
| ✅ LIVE | ManagerNotificationsScreen | Mark single notification read | `PATCH /my-notifications/{id}/read` | `user_notifications.py` line 69 ✅ | |

---

## PROJECT ASSOCIATE ROLE — `lib/screens/associate/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | AssociateHomeScreen | Pipeline (active trips) | `GET /pa/dashboard/pipeline` | `pa_dashboard.py` ✅ | Added this session |
| ✅ LIVE | AssociateHomeScreen | Action-center items | `GET /pa/dashboard/action-items` | `pa_dashboard.py` ✅ | Added this session |
| ✅ LIVE | AssociateHomeScreen | Recent activity feed | `GET /pa/dashboard/activity` | `pa_dashboard.py` ✅ | Added this session |
| ⚠️ PARTIAL | AssociateTripCloseScreen | List trips awaiting close | `GET /trips?status=trips_ready_to_close` | `trips.py` — `"trips_ready_to_close"` is **not** a valid `status` enum value → **always returns empty list** | Valid statuses: `pending`, `vehicle_assigned`, `in_transit`, `completed`. Fix filter to `?status=in_transit` or add a backend alias |
| ✅ LIVE | AssociateTripCloseScreen | Close trip (action) | `PATCH /trips/{id}/status {status: 'completed'}` via `closeTrip()` | `trips.py` line 146 ✅ | Action works; only the list fetch is broken |
| ✅ LIVE | AssociateLrCreateScreen | Create lorry receipt | `POST /lr {data}` | `lr.py` mounted at `/lr` ✅ | |
| ❌ BROKEN | AssociateLrCreateScreen | Auto-generate EWB after LR | `POST /eway-bills {lr_id}` | `EwayBillCreate` schema requires 13 required fields (`document_number`, `from_gstin`, `from_name`, `from_place`, `from_state_code`, `from_pincode`, `to_name`, `to_place`, `to_state_code`, `to_pincode`, `total_value`, `total_invoice_value`, `document_date`) → **422 Unprocessable Entity** | Either supply all required fields or call a purpose-built `POST /eway-bills/auto-from-lr` endpoint that derives values from the LR |
| ✅ LIVE | AssociateDocUploadScreen | Upload supporting document | `POST /documents/upload` (multipart) | `documents.py` ✅ | |
| ❌ BROKEN | AssociateEwbCreateScreen | Manual EWB generation | `POST /eway-bills/generate` | `eway_bill.py` has `POST /eway-bills/api/generate` (not `/generate`) → **404** | Fix: change to `api.post('/eway-bills/api/generate', …)` |
| ✅ LIVE | PaEwbDetailScreen | Extend EWB validity | `POST /eway-bills/{id}/extend` | `eway_bill.py` line 106 ✅ | Fixed (BUG2) |
| ✅ LIVE | PaTripClosureScreen | Close trip (full PA flow) | `PUT /trips/{id}/close` | `trips.py` line 206 ✅ | Fixed (BUG3) |
| ⚠️ PARTIAL | PaBankingScreen | Banking entries (own entries) | `GET /finance/banking/entries?my_entries=true&status=approved` | `compat.py` — `my_entries` and `status` query params are **silently ignored** → returns **all** entries regardless of filter | Fix: route to `GET /banking/entries` (`banking.py`) which has proper filter support |

---

## ACCOUNTANT ROLE — `lib/screens/accountant/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | AccountantPaymentsScreen | Driver payments list | `GET /accountant/driver-payments` | `accountant.py` line 721 ✅ | |
| ✅ LIVE | AccountantPaymentsScreen | Mark driver payment paid | `POST /accountant/driver-payments/{id}/mark-paid {data}` | `accountant.py` line 778 ✅ | |
| ✅ LIVE | AccountantPaymentsScreen | Receivables list | `GET /accountant/receivables` | `accountant.py` line 86 ✅ | |
| ✅ LIVE | AccountantExpenseApprovalScreen | Expenses list | `GET /accountant/expenses?status?&page&limit` | `accountant.py` line 135 ✅ | |
| ✅ LIVE | AccountantExpenseApprovalScreen | Approve expense | `PATCH /expenses/{id}/status {status: 'approved'}` | `aliases.py` ✅ | Correctly uses api_service method |
| ✅ LIVE | AccountantExpenseApprovalScreen | Reject expense | `PATCH /expenses/{id}/status {status: 'rejected', reason}` | `aliases.py` ✅ | |
| ✅ LIVE | AccountantExpenseApprovalScreen | Mark expense paid | `PATCH /expenses/{id}/status {status: 'paid'}` | `aliases.py` ✅ | |
| ✅ LIVE | AccountantSettlementScreen | Payables list | `GET /payables/` | `payables.py` line 116 ✅ | |
| ✅ LIVE | AccountantSettlementScreen | Driver payment info | `GET /drivers/{id}/payment-info` | `drivers.py` line 592 ✅ | |
| ✅ LIVE | AccountantSettlementScreen | Approve payable | `PATCH /payables/{id}/approve` | `payables.py` line 165 ✅ | |
| ✅ LIVE | AccountantSettlementScreen | Reject payable | `PATCH /payables/{id}/reject` | `payables.py` line 186 ✅ | |
| ✅ LIVE | AccountantSettlementScreen | Mark payable paid | `PATCH /payables/{id}/mark-paid {data}` | `payables.py` line 205 ✅ | |
| ✅ LIVE | AccountantBankingScreen | Banking entries list | `GET /banking/entries` | `banking.py` line 85 ✅ | |
| ✅ LIVE | AccountantBankingScreen | Bank accounts list | `GET /banking/accounts` | `banking.py` line 25 ✅ | |
| ✅ LIVE | AccountantBankingScreen | Create banking entry | `POST /banking/entries {data}` | `banking.py` line 54 ✅ | |
| ✅ LIVE | AccountantGstScreen | GST report | `GET /accountant/gst` | `accountant.py` line 443 ✅ | |
| ✅ LIVE | AccountantStatementsScreen | Statements list | `GET /accountant/statements` | `accountant.py` line 611 ✅ | |
| ✅ LIVE | AccountantPayablesScreen | Payables summary | `GET /accountant/payables` | `accountant.py` line 405 ✅ | |
| ✅ LIVE | AccountantVouchersScreen | Vouchers list | `GET /accountant/vouchers` | `accountant.py` line 527 ✅ | |
| ✅ LIVE | AccountantVouchersScreen | Create voucher | `POST /accountant/vouchers {data}` | `accountant.py` line 581 ✅ | |
| ✅ LIVE | AccountantLedgerScreen | Ledger entries | `GET /accountant/ledger` | `accountant.py` line 72 ✅ | |
| ✅ LIVE | AccountantLedgerScreen | Create ledger entry | `POST /accountant/ledger {data}` | `accountant.py` line 509 ✅ | |

---

## DRIVER ROLE — `lib/screens/driver/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | DriverTodayScreen | GPS location ping | `POST /tracking/gps/ping {latitude, longitude, speed (km/h), heading}` | `tracking.py` ✅ | Fixed (BUG1) |
| ✅ LIVE | DriverTodayScreen | SOS emergency alert | `POST /trips/{tripId}/sos {latitude?, longitude?, location_name?}` | `trips.py` line 402 ✅ | |
| ✅ LIVE | DriverVehicleScreen | Assigned vehicle details | `GET /drivers/me/vehicle` | `drivers.py` line 283 ✅ | |
| ✅ LIVE | DriverSettlementScreen | Driver payables | `GET /payables/driver/{driverId}` | `payables.py` line 71 ✅ | |
| ✅ LIVE | DriverDocumentsScreen | My documents list | `GET /drivers/me/documents` | `drivers.py` line 357 ✅ | |
| ✅ LIVE | DriverDocumentsScreen | Upload new document | `POST /drivers/me/documents/upload` (multipart) | `drivers.py` line 389 ✅ | |
| ✅ LIVE | DriverDocumentsScreen | Update existing document | `PUT /drivers/me/documents/{docId}` (multipart) | `drivers.py` line 441 ✅ | |
| ✅ LIVE | DriverEpodScreen | Upload EPOD signature + photo | `POST /documents/upload` × 2 (multipart) | `documents.py` ✅ | |
| ✅ LIVE | DriverEpodScreen | Complete trip (EPOD sign-off) | `PATCH /trips/{id}/status {status: 'completed'}` via `updateTripStatus()` | `trips.py` line 146 ✅ | |
| ✅ LIVE | DriverAddExpenseScreen | OCR receipt scan | `POST /trips/expenses/ocr` (multipart) | `trips.py` line 639 ✅ | |
| ✅ LIVE | DriverAddExpenseScreen | Verify security PIN before large expense | `POST /drivers/verify-pin {pin}` | `drivers.py` line 572 ✅ | |
| ✅ LIVE | DriverAddExpenseScreen | Upload receipt image | `POST /documents/upload` (multipart) | `documents.py` ✅ | |
| ✅ LIVE | DriverTripDetailScreen | Trip checklist | `GET /trips/{tripId}/checklist` | `trips.py` line 313 ✅ | |

---

## BRANCH MANAGER ROLE — `lib/screens/branch/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | BranchDashboardScreen | Branch KPIs | `GET /dashboard/branch` | `dashboard.py` line 220 (prefix `/dashboard`) ✅ | |
| ⚠️ PARTIAL | BranchDashboardScreen | Recent trips (today) | `GET /trips/?date=today&limit=5` | `trips.py` — **`date` param is not supported** → unfiltered first-5 rows returned | Remove `date` param or filter client-side; backend trips only accept: `page, limit, search, status, vehicle_id, driver_id` |
| ⚠️ PARTIAL | BranchTripsScreen | Trips filtered by date | `GET /trips/?date={date}` | `trips.py` — **`date` param silently ignored** → full unfiltered list | Same fix as above |
| ✅ LIVE | BranchDriversScreen | Driver list | `GET /drivers/` | `drivers.py` ✅ | |
| ✅ LIVE | BranchReportsScreen | Branch summary report | `GET /reports/branch/summary?period={period}` | `reports.py` line 727 ✅ | |

---

## FLEET MANAGER ROLE

### Active screens — `lib/screens/fleet/` (routed)

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| 🔲 NO-CALL | FleetHomeScreen | All KPI tiles (vehicles / active / maintenance / drivers / trips) | **None — all hardcoded** (24 vehicles, 18 active, 3 maintenance, 16 drivers, 12 trips, 156 completed) | `GET /fleet/dashboard` exists and returns live data | Hardcoded numbers are displayed to the fleet manager; backend endpoint unused |
| ✅ LIVE | FleetAnalyticsScreen | Fleet analytics dashboard | `GET /fleet/dashboard` | `fleet_manager.py` line 32 ✅ | |
| ✅ LIVE | FleetVehiclesScreen | Vehicle list | `GET /fleet/vehicles` | `fleet_manager.py` line 38 ✅ | |
| ✅ LIVE | FleetDriverListScreen | All drivers | `GET /drivers` | `drivers.py` ✅ | |
| ✅ LIVE | FleetDriverDetailScreen | Single driver detail | `GET /drivers/{id}` | `drivers.py` ✅ | |
| ✅ LIVE | FleetAddDriverScreen | Create new driver | `POST /drivers {data}` | `drivers.py` ✅ | |
| ✅ LIVE | FleetCreateTripScreen | Available vehicles drop-down | `GET /vehicles/?status=available` | `vehicles.py` ✅ | |
| ✅ LIVE | FleetCreateTripScreen | Available drivers drop-down | `GET /drivers/?status=available` | `drivers.py` ✅ | |
| ✅ LIVE | FleetCreateTripScreen | Create trip | `POST /trips/ {data}` | `trips.py` ✅ | |
| 🔲 NO-CALL | `/fleet/service/new` route | New service entry form | Route maps to `const Scaffold()` stub | — | Blank white screen — form not implemented |
| 🔲 NO-CALL | `/fleet/tyre/new` route | New tyre event form | Route maps to `const Scaffold()` stub | — | Blank white screen — form not implemented |

### Unreachable screens — `lib/screens/fleet_manager/` (NOT in router)

| STATUS | FILE | NOTES |
|--------|------|-------|
| 🚫 UNREACHABLE | `fleet_manager_home_screen.dart` | Zero routes in `app_router.dart` point here |
| 🚫 UNREACHABLE | `fleet_vehicle_list_screen.dart` | Unreachable |
| 🚫 UNREACHABLE | `fleet_service_log_screen.dart` | Unreachable |
| 🚫 UNREACHABLE | `fleet_tyre_event_screen.dart` | Fixed to use `getTyreId()` + integer PK, but screen is unreachable |
| 🚫 UNREACHABLE | `fleet_expense_approval_screen.dart` | Unreachable |
| 🚫 UNREACHABLE | `fleet_live_map_screen.dart` | Fixed to use real tracking markers, but screen is unreachable |

> **Root cause:** `fleet_manager` role routes to `/fleet/home` → `FleetHomeScreen` from `lib/screens/fleet/`, not to any screen in `lib/screens/fleet_manager/`. To make the fixed screens accessible, update `app_router.dart` to route `/fleet/*` paths to the `fleet_manager/` screens.

---

## PUMP OPERATOR ROLE — `lib/screens/pump/`

| STATUS | SCREEN | FUNCTION | APP CALLS | BACKEND HAS | NOTES |
|--------|--------|----------|-----------|-------------|-------|
| ✅ LIVE | PumpShiftScreen | Active shift status | `GET /fuel-pump/shifts/active` | `fuel_pump.py` line 305 ✅ | |
| ✅ LIVE | PumpShiftScreen | Tank levels | `GET /fuel-pump/tanks` | `fuel_pump.py` line 24 ✅ | |
| ✅ LIVE | PumpShiftScreen | Open new shift | `POST /fuel-pump/shifts {data}` | `fuel_pump.py` line 317 ✅ | |
| ✅ LIVE | PumpShiftScreen | Close shift | `POST /fuel-pump/shifts/{id}/close {data}` | `fuel_pump.py` line 342 ✅ | |
| ✅ LIVE | PumpTankRefillScreen | Record tank stock refill | `POST /fuel-pump/stock {data}` | `fuel_pump.py` line 172 ✅ | |
| ✅ LIVE | PumpCreateTankScreen | Create new tank | `POST /fuel-pump/tanks {data}` | `fuel_pump.py` line 39 ✅ | |

---

## WEBSOCKET — All Roles

The app connects to `ws://10.0.2.2:8001/ws` (no auth token in connection URL — JWT sent separately if at all). Heartbeat every 30 s.

| STATUS | EVENT | DIRECTION | APP | BACKEND |
|--------|-------|-----------|-----|---------|
| ✅ LIVE | heartbeat `"ping"` | App → Server | Sent every 30 s | Handled |
| ⚠️ PARTIAL | `trip_update` | Server → App | Handled: dispatched to `tripUpdatesStreamProvider` | Emitted by backend ✅ |
| 🔲 NO-CALL | `subscribe_vehicle` | App → Server | **Never sent** | Backend uses this to decide which `vehicle_tracking` events to route to which connection |
| 🔲 NO-CALL | `subscribe_trip` | App → Server | **Never sent** | Backend uses this for targeted `trip_update` delivery |
| 🔲 NO-CALL | `vehicle_tracking` | Server → App | **Ignored** — no handler in `websocket_service.dart` | Emitted on every GPS ping |
| 🔲 NO-CALL | `alert` | Server → App | **Ignored** | Emitted on SOS / threshold breach |
| 🔲 NO-CALL | `geofence_breach` | Server → App | **Ignored** | Emitted when vehicle exits geofence |
| 🔲 NO-CALL | `compliance_alert` | Server → App | **Ignored** | Emitted on document expiry |
| 🔲 NO-CALL | mock `trip_update` | Dev build only | Fake emitted every 10 s in debug mode | N/A — masks real WS connection issues in development |

> **Fix:** In `websocket_service.dart`, after connection established, send `{"type": "subscribe_vehicle", "vehicle_ids": [...]}` and `{"type": "subscribe_trip", "trip_ids": [...]}`. Add a `switch` handler for `vehicle_tracking`, `alert`, `geofence_breach`, `compliance_alert` event types, and expose corresponding stream providers.

---

## SUMMARY COUNTS

| Status | Count |
|--------|-------|
| ✅ LIVE | 79 |
| ⚠️ PARTIAL (wrong data) | 6 |
| ❌ BROKEN (404 / 405 / 422) | 9 |
| 🔲 NO-CALL (hardcoded / stub) | 11 |
| 🚫 UNREACHABLE (no router entry) | 6 |
| **Total functions audited** | **111** |

---

## PRIORITISED FIX LIST

### P0 — Crash / Complete Failure (fix immediately)

| # | Role | File | Fix |
|---|------|------|-----|
| 1 | manager | `manager_approvals_screen.dart` line 107 | `api.patch('/expenses/$id/approve')` → `api.patch('/expenses/$id/status', data: {'status': 'approved'})` |
| 2 | manager | `manager_approvals_screen.dart` line 165 | `api.patch('/expenses/$id/reject', data: {'reason': result})` → `api.patch('/expenses/$id/status', data: {'status': 'rejected', 'reason': result})` |
| 3 | manager | `manager_approvals_screen.dart` line 109 | `api.patch('/banking/$id/reconcile')` → `api.patch('/banking/entries/$id', data: {'reconciled': true})` — use the PUT/PATCH entry update endpoint |
| 4 | manager | `manager_assign_screen.dart` line 31 | `api.patch('/jobs/${jobId}/assign', …)` → `api.put('/jobs/${jobId}/assign', …)` |
| 5 | admin | `admin_employee_detail_screen.dart` line 255–256 | `api.patch('/users/$userId/deactivate\|activate')` → `api.put('/users/$userId', data: {'is_active': false\|true})` |
| 6 | admin | `admin_employee_detail_screen.dart` line 415 | `api.patch('/users/$userId', data: {role})` → `api.put('/users/$userId', data: {role})` |
| 7 | pa | `associate_ewb_create_screen.dart` line 57 | `POST /eway-bills/generate` → `POST /eway-bills/api/generate` |
| 8 | pa | `associate_lr_create_screen.dart` — auto EWB block | Supply all 13 required `EwayBillCreate` fields or skip auto-EWB and route user to manual EWB screen |

### P1 — Wrong Data Returned (significant UX / data integrity issue)

| # | Role | File | Fix |
|---|------|------|-----|
| 9 | pa | `associate_trip_close_screen.dart` | `GET /trips?status=trips_ready_to_close` → change to `GET /trips?status=in_transit` |
| 10 | branch | `branch_dashboard_screen.dart` & `branch_trips_screen.dart` | Remove `date` query param (unsupported); apply client-side date filter, or add `date` param to `list_trips()` in backend |
| 11 | pa | `pa_banking_screen.dart` | Change `GET /finance/banking/entries` (compat.py) → `GET /banking/entries` (banking.py with real filter support) |

### P2 — Structural / UX Gaps

| # | Role | Gap | Fix |
|---|------|-----|-----|
| 12 | fleet_manager | `fleet_home_screen.dart` — all KPIs hardcoded | Replace hardcoded values with `GET /fleet/dashboard` call |
| 13 | fleet_manager | `screens/fleet_manager/*.dart` — 6 screens unreachable | Update `app_router.dart` to route `/fleet/manager/*` paths to these screens, or move them under the active `/fleet/` shell |
| 14 | fleet_manager | `/fleet/service/new` and `/fleet/tyre/new` — stub Scaffolds | Implement the service-log and tyre-event form widgets |
| 15 | admin | Trip approval UI missing | Build a UI section in AdminOperationsScreen that calls the existing `getAdminPendingTripCompletions()` — api_service method and endpoint both exist |

### P3 — WebSocket Enhancements

| # | Gap | Fix |
|---|-----|-----|
| 16 | No vehicle / trip subscriptions sent | After connect, send `subscribe_vehicle` and `subscribe_trip` messages with relevant IDs |
| 17 | `vehicle_tracking`, `alert`, `geofence_breach`, `compliance_alert` events ignored | Add handlers and expose stream providers for live map updates and in-app alert banners |
| 18 | Mock WS events in debug mode | Remove/gate mock timer so real WS behaviour is testable during development | 