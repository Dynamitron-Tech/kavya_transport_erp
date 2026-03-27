# Kavya Transports ERP — Cross-Layer Audit Report

**Generated**: June 2025  
**Scope**: FastAPI Backend · React Frontend · Flutter Driver App  
**Mode**: READ-ONLY (no code changes)

---

## Section A — Backend API Contract (Source of Truth)

All endpoints are mounted under `/api/v1` via `backend/app/api/v1/router.py`.  
Responses use the `APIResponse` wrapper: `{ success: bool, data: Any, message: str, pagination?: PaginationMeta }`.

### A.1 Route Prefixes

| Prefix | Endpoint File | Description |
|---|---|---|
| *(no prefix)* | `compat.py` | ~60+ compatibility/alias routes |
| *(no prefix)* | `aliases.py` | Flat aliases (`/expenses`, `/fuel`, `/routes`, `/ewb`, etc.) |
| `/auth` | `auth.py` | Login, refresh, me, change-password, logout, fcm-token |
| `/users` | `users.py` | User CRUD |
| `/admin` | `admin.py` | Tenant/branch management |
| `/clients` | `clients.py` | Client CRUD + sub-resources (jobs, invoices, ledger, outstanding) |
| `/vehicles` | `vehicles.py` | Vehicle CRUD + overview, trips, maintenance, documents, health-score |
| `/drivers` | `drivers.py` | Driver CRUD + dashboard, licenses, trips, behaviour, documents, performance, attendance, assign/unassign, status, alerts |
| `/jobs` | `jobs.py` | Job CRUD + status, assign, approve, lookups |
| `/lr` | `lr.py` | LR CRUD + generate, cancel, print, status-history, POD upload/verify, lookups |
| `/eway-bills` | `eway_bill.py` | EWB CRUD + `/api/generate`, `/api/cancel`, `/api/extend`, lookups |
| `/trips` | `trips.py` | Trip CRUD + start/reach/close/complete/dispatch, status, expenses, fuel, lookups |
| `/finance` | `finance.py` | Invoices, payments, ledger, banking, receivables, payables, GST, profit-loss, vendors, routes |
| `/tracking` | `tracking.py` | Live, vehicle, trip trail, alerts, GPS positions, GPS path |
| `/documents` | `documents.py` | Document CRUD + submit, approve, reject, stats, lookups |
| `/reports` | `reports.py` | Report endpoints + export |
| `/dashboard` | `dashboard.py` | Overview, fleet-stats, trip-stats, finance-stats, charts, notifications, PA endpoints |
| `/fleet` | `fleet_manager.py` | Fleet dashboard, vehicles, trips, expiring-documents, plus sub-services |
| `/tyre` | `tyre.py` | Tyre CRUD |
| `/service` | `service.py` | Service/maintenance CRUD |
| `/accountant` | `accountant.py` | Accountant dashboard, invoices, payments, ledger, receivables, expenses, banking |
| `/vahan` | `vahan.py` | RC, insurance, fitness, permit, PUC, full-check |
| `/sarathi` | `sarathi.py` | DL verify, details |
| `/echallan` | `echallan.py` | Vehicle, driver, status lookup |
| `/gst` | `gst.py` | GSTIN verification |
| `/maps` | `maps.py` | Route distance, geocode, reverse-geocode |
| `/payments` | `payments.py` | Razorpay create-link, verify, status |
| `/notifications` | `notifications.py` | Push, SMS, WhatsApp |
| `/fuel-prices` | `fuel.py` | City fuel price, bulk prices |

### A.2 Key Backend Enums (from SQLAlchemy Models)

| Entity | Enum | Valid Values |
|---|---|---|
| **Job** | `JobStatusEnum` | `draft`, `pending_approval`, `approved`, `in_progress`, `completed`, `cancelled`, `on_hold` |
| **Job** | `JobPriority` | `low`, `normal`, `high`, `urgent` |
| **Job** | `ContractType` | `spot`, `contract`, `dedicated` |
| **Trip** | `TripStatusEnum` | `planned`, `vehicle_assigned`, `driver_assigned`, `ready`, `started`, `loading`, `in_transit`, `unloading`, `completed`, `cancelled` |
| **Trip** | `ExpenseCategory` | `fuel`, `toll`, `food`, `parking`, `loading`, `unloading`, `police`, `rto`, `repair`, `tyre`, `misc`, `advance` |
| **LR** | `LRStatus` | `draft`, `generated`, `in_transit`, `delivered`, `pod_received`, `cancelled` |
| **LR** | `PaymentMode` | `to_pay`, `paid`, `to_be_billed` |
| **Vehicle** | `VehicleType` | `truck`, `trailer`, `tanker`, `container`, `lcv`, `mini_truck` |
| **Vehicle** | `VehicleStatus` | `available`, `on_trip`, `maintenance`, `breakdown`, `inactive` |
| **Vehicle** | `OwnershipType` | `owned`, `leased`, `attached`, `market` |
| **Invoice** | `InvoiceStatus` | `draft`, `pending`, `sent`, `partially_paid`, `paid`, `overdue`, `cancelled`, `disputed` |
| **Invoice** | `InvoiceType` | `tax_invoice`, `proforma`, `credit_note`, `debit_note` |
| **Payment** | `PaymentStatus` | `pending`, `completed`, `failed`, `reversed` |
| **Payment** | `PaymentMethod` | `cash`, `bank_transfer`, `cheque`, `upi`, `card`, `neft`, `rtgs`, `adjustment` |
| **Ledger** | `LedgerType` | `receivable`, `payable`, `income`, `expense`, `asset`, `liability` |
| **User** | `RoleType` | `admin`, `manager`, `fleet_manager`, `accountant`, `project_associate`, `driver` |

### A.3 Backend Auth Response

`POST /auth/login` returns `TokenResponse`:

```
{
  access_token: str,
  refresh_token: str,
  token_type: str,
  user: {
    id: int,
    email: str,
    first_name: str,
    last_name: Optional[str],
    roles: List[str],
    permissions: List[str],
    avatar_url: Optional[str],
    branch_id: Optional[int],
    tenant_id: Optional[int]
  }
}
```

---

## Section B — Flutter App Mismatches

### B.1 Endpoint Path Mismatches

| # | Severity | Flutter Calls | Backend Has | Issue |
|---|---|---|---|---|
| B1 | **CRASH** | `GET /dashboard/fleet-manager` | No such route | Fleet manager dashboard will 404. Backend has `GET /fleet/dashboard`. |
| B2 | **CRASH** | `GET /dashboard/accountant` | No such route | Accountant dashboard will 404. Backend has `GET /accountant/dashboard/kpis` (via compat). |
| B3 | **CRASH** | `GET /dashboard/associate` | No such route | Associate dashboard will 404. Backend has `GET /dashboard/pa/kpis`. |
| B4 | **CRASH** | `GET /expenses` with `?status=pending` | `GET /expenses` exists (aliases.py) but has no `status` filter param — only `page` and `limit` | Will return all expenses, not just pending. Fleet/accountant pending-expense screens show wrong data. |
| B5 | **CRASH** | `PATCH /expenses/{id}/status` | No such route | Approve/reject expense will 404. Backend verifies via `POST /trips/{trip_id}/expenses/{expense_id}/verify`. |
| B6 | **FEATURE BROKEN** | `POST /eway-bills/generate` | `POST /eway-bills/api/generate` | E-way bill generation will 404 — path missing `/api` segment. |
| B7 | **FEATURE BROKEN** | `PATCH /eway-bills/{id}/extend` | `POST /eway-bills/api/extend` | Wrong HTTP method (PATCH vs POST) and wrong path (no `/api`, uses `/{id}` vs request body). |
| B8 | **FEATURE BROKEN** | `PATCH /trips/{id}/status` | `POST /trips/{id}/status` | Wrong HTTP method — PATCH vs POST. Trip status changes (close trip) will 405. |
| B9 | **FEATURE BROKEN** | `POST /services` | `POST /service` (prefix is `/service`, root POST) | Path mismatch: `/services` (plural) vs `/service` (singular). Service log will 404. |
| B10 | **FEATURE BROKEN** | `POST /tyres/events` | No such route | Backend has `POST /tyre` (create tyre), no `events` sub-route. Tyre event recording will 404. |
| B11 | **WRONG DATA** | `GET /tracking/gps` | `GET /tracking/gps/positions` | GPS positions will 404 — missing `/positions` in path. |
| B12 | **WRONG DATA** | `PATCH /notifications/{id}/read` | `POST /dashboard/notifications/{id}/read` or `POST /notifications/{id}/read` | Wrong HTTP method (PATCH vs POST) and possibly wrong prefix. |
| B13 | **WARNING** | `POST /auth/fcm-token` | Route exists in auth.py (FCMTokenRequest) | Verify path is exactly `/auth/fcm-token` — appears correct. |

### B.2 Data Model / Deserialization Mismatches

| # | Severity | Field | Backend Returns | Flutter Expects | Impact |
|---|---|---|---|---|---|
| B14 | **CRASH** | User `username` | Not returned — backend `UserInfo` has `email`, `first_name`, `last_name` | `json['username']` — falls back to `json['name']` then `''` | `user.username` always empty string. Display shows blank name. |
| B15 | **CRASH** | User `fullName` | `first_name` + `last_name` (separate fields) | `json['full_name']` — falls back to `json['name']` then `''` | `user.fullName` always empty string. No combined `full_name` field in backend response. |
| B16 | **WRONG DATA** | User `isActive` | `is_active` exists in `UserResponse` but NOT in `UserInfo` (login response) | `json['is_active']` | Will default to `true` on login; correct only when fetching from `/users/{id}`. |
| B17 | **WRONG DATA** | Job `origin` | Backend returns `origin_city` | Flutter reads `json['origin']` | Job origin will be null unless backend aliases it. |
| B18 | **WRONG DATA** | Job `destination` | Backend returns `destination_city` | Flutter reads `json['destination']` | Job destination will be null. |
| B19 | **WRONG DATA** | Job `date` | Backend returns `job_date` | Flutter reads `json['date']` | Job date will be null. |
| B20 | **WRONG DATA** | Job `vehicleNumber` | Not in `JobResponse` schema | Flutter reads `json['vehicle_number']` | Always null — backend has no `vehicle_number` on jobs. |
| B21 | **WRONG DATA** | Job `vehicleId` | Not in `JobResponse` schema | Flutter reads `json['vehicle_id']` | Always null — vehicles are on trips, not directly on jobs. |
| B22 | **WRONG DATA** | Job `driverName` | Not in `JobResponse` schema | Flutter reads `json['driver_name']` | Always null — drivers are on trips, not directly on jobs. |
| B23 | **WRONG DATA** | Job `lrNumber` | Not in `JobResponse` schema (has `lr_count` instead) | Flutter reads `json['lr_number']` | Always null. `needsLR` getter always broken. |
| B24 | **WRONG DATA** | Job `freightAmount` | Not in `JobResponse` (has `agreed_rate`, `total_amount`) | Flutter reads `json['freight_amount']` | Always null. |
| B25 | **WRONG DATA** | Job default status | Backend default: `"draft"` | Flutter default: `"created"` | Status comparison logic may break. |
| B26 | **WRONG DATA** | LR `goodsDescription` | Not in `LRResponse` (items have `description`) | Flutter reads `json['goods_description']` | Always null. |
| B27 | **WRONG DATA** | LR `numberOfPackages` | Not in `LRResponse` (items have `packages`) | Flutter reads `json['number_of_packages']` | Always null. |
| B28 | **WRONG DATA** | LR `weightKg` | Not in `LRResponse` (items have `actual_weight`) | Flutter reads `json['weight_kg']` | Always null. |
| B29 | **WRONG DATA** | LR `goodsValue` | Not in `LRResponse` | Flutter reads `json['goods_value']` | Always null. |
| B30 | **WRONG DATA** | LR `riskType` | Not in `LRResponse` | Flutter reads `json['risk_type']` | Always null. |
| B31 | **WRONG DATA** | LR `notes` | Not in `LRResponse` (has `remarks`) | Flutter reads `json['notes']` | Always null. |
| B32 | **WRONG DATA** | LR `ewbNumber` | Backend returns `eway_bill_number` | Flutter reads `json['ewb_number']` | Always null — key name different. `hasEwb` getter always false. |
| B33 | **WRONG DATA** | LR `date` | Backend returns `lr_date` | Flutter reads `json['date']` | Always null. |
| B34 | **WRONG DATA** | LR `origin`/`destination` | LRResponse has `origin`, `destination` | Flutter uses `consignorAddress`/`consigneeAddress` for `fromLocation`/`toLocation` getters | The origin/destination fields exist but aren't parsed; getters use wrong fields. |
| B35 | **WRONG DATA** | Invoice `paidAmount` | Backend returns `amount_paid` | Flutter reads `json['paid_amount']` | Always null — key name mismatch. Balance calculation wrong. |
| B36 | **WRONG DATA** | Invoice `dueAmount` | Backend returns `amount_due` | Flutter reads `json['due_amount']` | Always null — key name mismatch. |
| B37 | **WRONG DATA** | Invoice `lineItems` | Backend returns `items` (List[InvoiceItemResponse]) | Flutter reads `json['line_items']` | Always null — key name mismatch. |
| B38 | **WRONG DATA** | Invoice `gstBreakdown` | Backend returns `cgst_amount`, `sgst_amount`, `igst_amount` as flat fields | Flutter reads nested `json['gst_breakdown']` map | Always null — structure mismatch. GST getters (cgst, sgst, igst) always 0. |
| B39 | **WRONG DATA** | Invoice `payments` | Backend has `payments` relationship but not in `InvoiceResponse` schema | Flutter reads `json['payments']` | May or may not be included depending on endpoint. |
| B40 | **WRONG DATA** | Invoice default status | Backend default: `"draft"` | Flutter default: `"unpaid"` | Status comparison may break. |
| B41 | **WRONG DATA** | Vehicle `type` | Backend returns `vehicle_type` | Flutter reads `json['type']` | Always empty string — key name mismatch. |
| B42 | **WRONG DATA** | Vehicle default `status` | Backend default: `"available"` | Flutter default: `"idle"` | Status mismatch — `"idle"` never exists in backend. |
| B43 | **WRONG DATA** | Vehicle `currentDriverName` | Not in `VehicleResponse` | Flutter reads `json['current_driver_name']` | Always null. |
| B44 | **WRONG DATA** | Vehicle `currentDriverId` | Not in `VehicleResponse` | Flutter reads `json['current_driver_id']` | Always null. |
| B45 | **WRONG DATA** | Vehicle `odometerKm` | Backend returns `odometer_reading` | Flutter reads `json['odometer_km']` | Always null — key name mismatch. |
| B46 | **WRONG DATA** | Vehicle `lastLat`/`lastLng` | Backend returns `current_location` (string) | Flutter reads `json['last_lat']`, `json['last_lng']` | Always null — backend has string location, not lat/lng coords on VehicleResponse. |
| B47 | **WRONG DATA** | Vehicle `speed` | Not in `VehicleResponse` | Flutter reads `json['speed']` | Always null. |
| B48 | **WRONG DATA** | Vehicle `lastGpsUpdate` | Not in `VehicleResponse` | Flutter reads `json['last_gps_update']` | Always null. |
| B49 | **WRONG DATA** | Vehicle `nextServiceDue` | Not in `VehicleResponse` | Flutter reads `json['next_service_due']` | Always null. |
| B50 | **WRONG DATA** | Vehicle `nextServiceKm` | Not in `VehicleResponse` | Flutter reads `json['next_service_km']` | Always null. |
| B51 | **WRONG DATA** | Vehicle `documents` | Not in `VehicleResponse` (separate endpoint) | Flutter reads `json['documents']` | Always null. |
| B52 | **WRONG DATA** | Vehicle `currentTrip` | Not in `VehicleResponse` | Flutter reads `json['current_trip']` | Always null. |

### B.3 Response Unwrapping Issues

| # | Severity | Issue |
|---|---|---|
| B53 | **CRASH** | `getJobs()` does `resp is List ? resp : (resp as Map)['data'] ?? []` — but backend returns `APIResponse` where data is `{items: [...], total, page, limit}`. The data is a map with `items` key, not a list. Need to access `resp['data']['items']` or `resp['data']` depending on APIResponse unwrapping. |
| B54 | **CRASH** | Same issue for `getLRs()`, `getVehicles()`, `getTrips()`, `getInvoices()`, `getReceivables()`, `getPayments()`, `getNotifications()`, `getExpensesPending()`, `getGpsPositions()` — all try to cast data as list but backend returns paginated object `{items, total, page, limit}`. |
| B55 | **WARNING** | `getVehicleDetail()` returns `Map<String, dynamic>` directly — should unwrap from `APIResponse.data`. Most detail endpoints return `{success, data: {vehicle...}, message}`. |

---

## Section C — React Frontend Mismatches

### C.1 Endpoint Path Mismatches

| # | Severity | React Calls | Backend Has | Issue |
|---|---|---|---|---|
| C1 | **FEATURE BROKEN** | `GET /invoices` (financeService.listInvoices) | `GET /finance/invoices` | Path mismatch — missing `/finance` prefix. Unless aliases.py provides `/invoices`. |
| C2 | **FEATURE BROKEN** | `GET /ledger` (financeService.getLedger) | `GET /finance/ledger` | Path mismatch — missing `/finance` prefix. Unless compat provides `/ledger`. |
| C3 | **FEATURE BROKEN** | `GET /ewb` (ewayBillService.list) | `GET /eway-bills` | Path mismatch — `/ewb` vs `/eway-bills`. Aliases.py has `/ewb` route so this works. |
| C4 | **FEATURE BROKEN** | `POST /eway-bills/{id}/generate` | `POST /eway-bills/api/generate` | ID-based generate vs body-based generate. Path structure differs. |
| C5 | **FEATURE BROKEN** | `POST /eway-bills/{id}/cancel` with `{reason}` | `POST /eway-bills/api/cancel` | ID-based cancel vs body-based cancel. Path structure differs. |
| C6 | **FEATURE BROKEN** | `POST /eway-bills/{id}/extend` with `{reason}` | `POST /eway-bills/api/extend` | ID-based extend vs body-based extend. Path structure differs. |
| C7 | **WARNING** | `PUT /jobs/{id}/assign` (jobService.assign) | No `PUT /jobs/{id}/assign` | Backend has `POST /jobs/{id}/assign` — method mismatch (PUT vs POST). |
| C8 | **WARNING** | `PUT /trips/{id}/start` (tripService.start) | No `PUT` start endpoint | Backend has `POST /trips/{id}/start` or status change via `POST /trips/{id}/status`. |
| C9 | **WARNING** | `PUT /trips/{id}/close` (tripService.close) | Backend has close endpoint | Verify HTTP method — may be `POST` not `PUT`. |
| C10 | **WARNING** | `PUT /trips/{id}/reach` (tripService.reach) | Backend has reach endpoint | Verify HTTP method — may be `POST` not `PUT`. |
| C11 | **WARNING** | Fleet service calls `GET /fleet/tracking/live` | Backend tracking is under `/tracking/live` | Path mismatch — `/fleet/tracking/live` doesn't exist. |
| C12 | **WARNING** | Fleet service calls `GET /fleet/dashboard/charts/*` | Backend fleet_manager.py has `/fleet/dashboard` only | Charts endpoints may not exist under fleet. |
| C13 | **WARNING** | Fleet service calls `GET /fleet/maintenance/work-orders` | Not in fleet_manager.py | Endpoint doesn't exist. |
| C14 | **WARNING** | Fleet service calls `GET /fleet/maintenance/parts-inventory` | Not in fleet_manager.py | Endpoint doesn't exist. |
| C15 | **WARNING** | Fleet service calls `GET /fleet/maintenance/battery` | Not in fleet_manager.py | Endpoint doesn't exist. |
| C16 | **WARNING** | Fleet service calls `GET /fleet/fuel/summary` | Not in fleet_manager.py | Endpoint doesn't exist. Fuel is under `/fuel-prices`. |
| C17 | **WARNING** | Fleet service calls `GET /fleet/reports/*` (6 report endpoints) | Not in fleet_manager.py | Endpoints don't exist. |
| C18 | **WARNING** | Fleet service calls `GET /fleet/drivers` | Not in fleet_manager.py | Endpoint doesn't exist. Drivers are under `/drivers`. |
| C19 | **WARNING** | Fleet service calls `GET /fleet/drivers/{id}/profile` | Not in fleet_manager.py | Endpoint doesn't exist. |
| C20 | **WARNING** | Fleet service calls `GET /fleet/vehicles/{id}/profile` | Backend has `GET /fleet/vehicles` (list) | Profile endpoint may not exist. |
| C21 | **WARNING** | `POST /jobs/{id}/submit-for-approval` | May not exist in backend | Need to verify — backend has status change endpoint. |
| C22 | **WARNING** | `POST /jobs/{id}/assign-vehicle`, `POST /jobs/{id}/assign-driver` | May not exist | Backend `POST /jobs/{id}/assign` may handle both. |

### C.2 Type / Enum Mismatches

| # | Severity | Field | React Type | Backend Enum | Issue |
|---|---|---|---|---|---|
| C23 | **WRONG DATA** | `RoleType` | Missing `'auditor'` | Backend has 6 roles: admin, manager, fleet_manager, accountant, project_associate, driver | React is missing `auditor` (which is also not in backend — consistent). |
| C24 | **WRONG DATA** | `JobStatus` | Has `'assigned'` | Backend has `'on_hold'` instead | React has `assigned` which doesn't exist in backend; backend has `on_hold` which React lacks. |
| C25 | **WRONG DATA** | `JobPriority` | Has `'medium'` | Backend has `'normal'` | Priority mismatch — `medium` vs `normal`. |
| C26 | **WRONG DATA** | `ContractType` | `'per_trip'`, `'per_ton'`, `'per_km'`, `'fixed'`, `'monthly'` | Backend: `'spot'`, `'contract'`, `'dedicated'` | Completely different contract type values. |
| C27 | **WRONG DATA** | `TripStatus` | Missing `'vehicle_assigned'`, `'driver_assigned'`, `'ready'` | Backend has 10 statuses | React has only 7 trip statuses vs backend's 10. |
| C28 | **WRONG DATA** | `ExpenseCategory` | Has `'driver_allowance'`, `'challan'`, `'other'` | Backend: `'food'`, `'parking'`, `'tyre'`, `'misc'`, `'advance'` | Several mismatched expense categories in both directions. |
| C29 | **WRONG DATA** | `InvoiceStatus` | Has `'partial'` | Backend: `'partially_paid'`, `'pending'`, `'disputed'` | Shortened name + missing statuses. |
| C30 | **WRONG DATA** | `InvoiceType` | `'client'`, `'vendor'` | Backend: `'tax_invoice'`, `'proforma'` | Completely different type values. |
| C31 | **WRONG DATA** | `PaymentMethod` | Has `'other'` | Backend: `'neft'`, `'rtgs'`, `'adjustment'` | Missing specific methods. |
| C32 | **WRONG DATA** | `LedgerType` | `'debit'`, `'credit'` | Backend: `'receivable'`, `'payable'`, `'income'`, `'expense'`, `'asset'`, `'liability'` | Completely different ledger types. |
| C33 | **WRONG DATA** | `EwayBillStatus` | 8 values including `'draft'`, `'extended'` | Backend has only 4: `'active'`, `'cancelled'`, `'completed'`, `'expired'` | React has many more statuses than backend. |
| C34 | **WRONG DATA** | `LRStatus` | Has `'pod_verified'` | Backend has 6: draft, generated, in_transit, delivered, pod_received, cancelled | React has extra `pod_verified` status. |
| C35 | **WRONG DATA** | `VehicleType` | Has `'pickup'`, `'other'` | Backend: `'lcv'` instead | Types partially overlap with extras on both sides. |

### C.3 Data Model Field Mismatches

| # | Severity | Interface | React Field | Backend Schema Field | Issue |
|---|---|---|---|---|---|
| C36 | **WRONG DATA** | `User` | `full_name?: string` | Not in `UserInfo` — has `first_name` + `last_name` | No `full_name` field returned; React also uses `first_name` and `last_name`. Likely works if either is present. |
| C37 | **WRONG DATA** | `Vehicle` | `year: number` | `year_of_manufacture: Optional[int]` | Key name mismatch. |
| C38 | **WRONG DATA** | `Vehicle` | `gps_enabled: boolean` | Not in `VehicleResponse` | Field doesn't exist in backend. |
| C39 | **WRONG DATA** | `Vehicle` | `total_km_run: number` | `odometer_reading: float` | Key name mismatch. |
| C40 | **WRONG DATA** | `Vehicle` | `mileage_per_liter` | `mileage_per_litre` is on model only, not on `VehicleResponse` | Not returned in API. |
| C41 | **WRONG DATA** | `Vehicle` | `current_driver_id` | Not in `VehicleResponse` | Not returned in API. |
| C42 | **WRONG DATA** | `Job` | `origin: string` | `origin_city: string` | Key name mismatch. |
| C43 | **WRONG DATA** | `Job` | `destination: string` | `destination_city: string` | Key name mismatch. |
| C44 | **WRONG DATA** | `Job` | `cargo_type` | `material_type` | Key name mismatch. |
| C45 | **WRONG DATA** | `Job` | `rate: number` | `agreed_rate` | Key name mismatch. |
| C46 | **WRONG DATA** | `Job` | `weight_tons` | `quantity` + `quantity_unit` | Different structure. |
| C47 | **WRONG DATA** | `Job` | `pickup_date: string` | `pickup_date: DateTime` | Type may be compatible (ISO string). |
| C48 | **WRONG DATA** | `Invoice` | `tax_amount: number` | `total_tax: Numeric` | Key name mismatch. |
| C49 | **WRONG DATA** | `Invoice` | `paid_amount: number` | `amount_paid: Numeric` | Key name mismatch. |
| C50 | **WRONG DATA** | `Invoice` | `balance_amount: number` | `amount_due: Numeric` | Key name mismatch. |
| C51 | **WRONG DATA** | `Invoice` | `gst_rate: number` | Not a single field — has `cgst_rate`, `sgst_rate`, `igst_rate` | Structure mismatch. |
| C52 | **WRONG DATA** | `Trip` | `total_distance` | `actual_distance_km` | Key name mismatch. |
| C53 | **WRONG DATA** | `Trip` | `fuel_issued` | Not in TripResponse | Field doesn't exist. |
| C54 | **WRONG DATA** | `Trip` | `fuel_consumed` | `actual_fuel_litres` (model-only, not in schema) | Not returned in API. |
| C55 | **WRONG DATA** | `Trip` | `total_fuel_cost` | `fuel_cost` | Key name mismatch. |
| C56 | **WRONG DATA** | `Trip` | `advance_amount` | `driver_advance` | Key name mismatch. |
| C57 | **WRONG DATA** | `Trip` | `total_expenses` | `total_expense` | Key name mismatch (plural vs singular). |
| C58 | **WRONG DATA** | `Trip` | `profit` | `profit_loss` | Key name mismatch. |
| C59 | **WRONG DATA** | `Trip` | `lr_numbers: string[]` | `lr_count: int` in TripResponse | Different structure — React expects LR number array, backend returns count. |
| C60 | **WRONG DATA** | `Payment` | `method: PaymentMethod` | `payment_method: PaymentMethod` | Key name mismatch. |
| C61 | **WRONG DATA** | `LedgerEntry` | `description, reference_type, reference_id` | `narration, linked entities (client_id, invoice_id, etc.)` | Different structure. |
| C62 | **WRONG DATA** | `LR` | `consignor_gst` | `consignor_gstin` | Key name mismatch. |
| C63 | **WRONG DATA** | `LR` | `consignee_gst` | `consignee_gstin` | Key name mismatch. |
| C64 | **WRONG DATA** | `LR` | `total_weight` | Not in LRResponse | Field doesn't exist. |
| C65 | **WRONG DATA** | `LR` | `total_packages` | Not in LRResponse | Field doesn't exist. |
| C66 | **WRONG DATA** | `LR` | `advance_amount` | Not in LRResponse | Field doesn't exist. |
| C67 | **WRONG DATA** | `LR` | `balance_amount` | Not in LRResponse | Field doesn't exist. |
| C68 | **WRONG DATA** | `LR` | `pod_received: boolean` | `pod_uploaded: boolean` | Key name mismatch. |
| C69 | **WRONG DATA** | `PaginatedResponse` | `{ items, total, page, page_size, total_pages }` | Backend: `{ items, total, page, limit }` + `PaginationMeta: { page, limit, total, pages }` | Pagination field names differ: `page_size` vs `limit`, `total_pages` vs `pages`. |

---

## Section D — Backend Gaps (Endpoints Clients Call That Don't Exist)

### D.1 Flutter Gaps

| # | Called By | Endpoint | Status | Fix Priority |
|---|---|---|---|---|
| D1 | Flutter | `GET /dashboard/fleet-manager` | **MISSING** | HIGH — Create alias or redirect to `/fleet/dashboard` |
| D2 | Flutter | `GET /dashboard/accountant` | **MISSING** | HIGH — Create alias or redirect to `/accountant/dashboard/kpis` |
| D3 | Flutter | `GET /dashboard/associate` | **MISSING** | HIGH — Create alias or redirect to `/dashboard/pa/kpis` |
| D4 | Flutter | `PATCH /expenses/{id}/status` | **MISSING** | HIGH — Expense approve/reject needs a new endpoint or redirect to trip-based verify |
| D5 | Flutter | `POST /services` (plural) | **EXISTS as `/service`** | MED — Add `/services` alias |
| D6 | Flutter | `POST /tyres/events` | **MISSING** | MED — No tyre event recording endpoint |
| D7 | Flutter | `GET /tracking/gps` | **EXISTS as `/tracking/gps/positions`** | MED — Add alias |

### D.2 React Gaps

| # | Called By | Endpoint | Status | Fix Priority |
|---|---|---|---|---|
| D8 | React | `GET /invoices` | May need alias for `/finance/invoices` | MED |
| D9 | React | `GET /ledger` | May need alias for `/finance/ledger` | MED |
| D10 | React | `GET /fleet/tracking/live` | **MISSING** — tracking is at `/tracking/live` | MED |
| D11 | React | `GET /fleet/dashboard/charts/*` (4 chart endpoints) | **MISSING** | MED |
| D12 | React | `GET /fleet/dashboard/recent-alerts` | **MISSING** | MED |
| D13 | React | `GET /fleet/dashboard/expiring-documents` | **MISSING** | MED |
| D14 | React | `GET /fleet/dashboard/upcoming-maintenance` | **MISSING** | MED |
| D15 | React | `GET /fleet/dashboard/active-trips` | **MISSING** | MED |
| D16 | React | `GET /fleet/drivers` | **MISSING** | MED |
| D17 | React | `GET /fleet/drivers/{id}/profile` | **MISSING** | MED |
| D18 | React | `GET /fleet/vehicles/{id}/profile` | **MISSING** | MED |
| D19 | React | `GET /fleet/maintenance/work-orders` | **MISSING** | LOW |
| D20 | React | `GET /fleet/maintenance/parts-inventory` | **MISSING** | LOW |
| D21 | React | `GET /fleet/maintenance/battery` | **MISSING** | LOW |
| D22 | React | `GET /fleet/fuel/summary` | **MISSING** | LOW |
| D23 | React | `GET /fleet/reports/*` (6 reports) | **MISSING** | LOW |
| D24 | React | `POST /eway-bills/{id}/generate` | Wrong path — should be `/eway-bills/api/generate` | MED |
| D25 | React | `POST /eway-bills/{id}/cancel` | Wrong path — should be `/eway-bills/api/cancel` | MED |
| D26 | React | `POST /eway-bills/{id}/extend` | Wrong path — should be `/eway-bills/api/extend` | MED |
| D27 | React | `POST /jobs/{id}/submit-for-approval` | **Likely MISSING** | MED |
| D28 | React | `POST /jobs/{id}/assign-vehicle`, `/assign-driver` | **Likely MISSING** | MED |

---

## Section E — Data Model Mismatches (Field-by-Field)

### E.1 User / Auth

| Field | Backend (`UserInfo`) | Flutter (`User.fromJson`) | React (`User`) |
|---|---|---|---|
| `id` | `int` | `int` ✅ | `number` ✅ |
| `email` | `str` | `json['email']` ✅ | `string` ✅ |
| `first_name` | `str` | ❌ Not parsed | `string?` ✅ |
| `last_name` | `Optional[str]` | ❌ Not parsed | `string?` ✅ |
| `full_name` | ❌ Not returned | `json['full_name']` → always `''` | `string?` may be empty |
| `username` | ❌ Not returned | `json['username']` → always `''` | ❌ Not defined |
| `roles` | `List[str]` | ✅ Parsed | ✅ `string[]` |
| `permissions` | `List[str]` | ❌ Not parsed | ✅ `string[]` |
| `phone` | ❌ Not in `UserInfo` | `json['phone']` → null | `string?` |
| `avatar_url` | `Optional[str]` | ❌ Not parsed | `string?` ✅ |
| `branch_id` | `Optional[int]` | ❌ Not parsed | `number?` ✅ |
| `tenant_id` | `Optional[int]` | ❌ Not parsed | `number?` ✅ |
| `is_active` | ❌ Not in `UserInfo` | `json['is_active']` → default `true` | `boolean?` |

### E.2 Job

| Field | Backend (`JobResponse`) | Flutter (`Job.fromJson`) | React (`Job`) |
|---|---|---|---|
| `id` | `int` | ✅ | ✅ |
| `job_number` | `str` | ✅ | ✅ |
| `job_date` | `date` | ❌ Reads `date` | ❌ Not mapped |
| `client_id` | `int` | ❌ Not parsed | ✅ |
| `client_name` | `str` | ✅ | ❌ Uses `client` object |
| `origin_city` | `str` | ❌ Reads `origin` | ❌ Reads `origin` |
| `destination_city` | `str` | ❌ Reads `destination` | ❌ Reads `destination` |
| `status` | Default `"draft"` | Default `"created"` ❌ | ✅ `JobStatus` |
| `priority` | `"normal"` | ❌ Not parsed | ❌ `"medium"` |
| `contract_type` | `"spot"` enum | ❌ Not parsed | ❌ `"per_trip"` |
| `lr_count` | `int` | ❌ Not parsed | ❌ Not mapped |
| `trip_count` | `int` | ❌ Not parsed | ❌ Not mapped |

### E.3 LR

| Field | Backend (`LRResponse`) | Flutter (`LR.fromJson`) | React (`LR`) |
|---|---|---|---|
| `lr_number` | `str` | ✅ | ✅ |
| `lr_date` | `date` | ❌ Reads `date` | ✅ `lr_date` |
| `origin` | `str` | ❌ Not parsed | ✅ |
| `destination` | `str` | ❌ Not parsed | ✅ |
| `vehicle_registration` | `str` | ❌ Not parsed | ❌ Not mapped |
| `driver_name` | `str` | ❌ Not parsed | ❌ Not mapped |
| `eway_bill_number` | `str` | ❌ Reads `ewb_number` | ✅ |
| `total_freight` | `Numeric` | ❌ Not parsed | ❌ `freight_amount` |
| `pod_uploaded` | `bool` | ❌ Not parsed | ❌ `pod_received` |
| `items` | `List[LRItemResponse]` | ❌ Not parsed | ✅ `items: LRItem[]` |
| `consignor_gstin` | `str` | ✅ | ❌ `consignor_gst` |
| `consignee_gstin` | `str` | ✅ | ❌ `consignee_gst` |

### E.4 Invoice

| Field | Backend (`InvoiceResponse`) | Flutter (`Invoice.fromJson`) | React (`Invoice`) |
|---|---|---|---|
| `invoice_number` | `str` | ✅ | ✅ |
| `client_name` | `str` | ✅ | ❌ Uses `client` object |
| `total_amount` | `Numeric` | ✅ | ✅ |
| `amount_paid` | `Numeric` | ❌ Reads `paid_amount` | ❌ Reads `paid_amount` |
| `amount_due` | `Numeric` | ❌ Reads `due_amount` | ❌ Reads `balance_amount` |
| `status` | Default `"draft"` | Default `"unpaid"` ❌ | ✅ `InvoiceStatus` but missing backend values |
| `cgst_amount` | `Numeric` | ❌ Reads `gst_breakdown.cgst` | ✅ `cgst_amount?` |
| `sgst_amount` | `Numeric` | ❌ Reads `gst_breakdown.sgst` | ✅ `sgst_amount?` |
| `igst_amount` | `Numeric` | ❌ Reads `gst_breakdown.igst` | ✅ `igst_amount?` |
| `total_tax` | `Numeric` | ❌ Not parsed | ❌ `tax_amount` |
| `items` | `List[InvoiceItemResponse]` | ❌ Reads `line_items` | ✅ `items: InvoiceItem[]` |

### E.5 Vehicle

| Field | Backend (`VehicleResponse`) | Flutter (`Vehicle.fromJson`) | React (`Vehicle`) |
|---|---|---|---|
| `registration_number` | `str` | ✅ | ✅ |
| `vehicle_type` | `str` | ❌ Reads `type` | ✅ |
| `status` | Default `"available"` | Default `"idle"` ❌ | ✅ |
| `odometer_reading` | `float` | ❌ Reads `odometer_km` | ❌ `total_km_run` |
| `year_of_manufacture` | `int?` | ❌ Not parsed | ❌ `year` |
| `current_location` | `str?` | ❌ Not parsed | ✅ |
| `gps_device_id` | `str?` | ❌ Not parsed | ✅ |

### E.6 Trip

| Field | Backend (`TripResponse`) | Flutter (not modeled) | React (`Trip`) |
|---|---|---|---|
| `trip_number` | `str` | N/A (raw map) | ✅ |
| `status` | Default `"planned"` | N/A | ✅ but missing 3 statuses |
| `fuel_cost` | `Numeric` | N/A | ❌ `total_fuel_cost` |
| `total_expense` | `Numeric` | N/A | ❌ `total_expenses` |
| `profit_loss` | `Numeric` | N/A | ❌ `profit` |
| `driver_advance` | `Numeric` | N/A | ❌ `advance_amount` |
| `actual_distance_km` | `Numeric` | N/A | ❌ `total_distance` |
| `lr_count` | `int` | N/A | ❌ `lr_numbers: string[]` |

---

## Section F — Status / Enum Mismatches (Cross-Layer)

### F.1 Job Status

| Value | Backend | Flutter | React |
|---|---|---|---|
| `draft` | ✅ | ❌ (default: `created`) | ✅ |
| `pending_approval` | ✅ | ❌ | ✅ |
| `approved` | ✅ | ❌ | ✅ |
| `assigned` | ❌ | ❌ | ✅ |
| `in_progress` | ✅ | ❌ | ✅ |
| `completed` | ✅ | ❌ | ✅ |
| `cancelled` | ✅ | ❌ | ✅ |
| `on_hold` | ✅ | ❌ | ❌ |
| `created` | ❌ | ✅ (default) | ❌ |
| `vehicle_assigned` | ❌ | ✅ (in `needsLR`) | ❌ |

### F.2 Trip Status

| Value | Backend | Flutter | React |
|---|---|---|---|
| `planned` | ✅ | ❌ | ✅ |
| `vehicle_assigned` | ✅ | ❌ | ❌ |
| `driver_assigned` | ✅ | ❌ | ❌ |
| `ready` | ✅ | ❌ | ❌ |
| `started` | ✅ | ❌ | ✅ |
| `loading` | ✅ | ❌ | ✅ |
| `in_transit` | ✅ | ❌ | ✅ |
| `unloading` | ✅ | ❌ | ✅ |
| `completed` | ✅ | ✅ (sends this) | ✅ |
| `cancelled` | ✅ | ❌ | ✅ |
| `active` | ❌ | ✅ (filter param) | ❌ |

### F.3 Vehicle Status

| Value | Backend | Flutter | React |
|---|---|---|---|
| `available` | ✅ | ❌ (default: `idle`) | ✅ |
| `on_trip` | ✅ | ❌ | ✅ |
| `maintenance` | ✅ | ❌ | ✅ |
| `breakdown` | ✅ | ❌ | ✅ |
| `inactive` | ✅ | ❌ | ✅ |
| `idle` | ❌ | ✅ (default) | ❌ |

### F.4 Invoice Status

| Value | Backend | Flutter | React |
|---|---|---|---|
| `draft` | ✅ | ❌ (default: `unpaid`) | ✅ |
| `pending` | ✅ | ❌ | ❌ |
| `sent` | ✅ | ❌ | ✅ |
| `partially_paid` | ✅ | ❌ | ❌ |
| `partial` | ❌ | ❌ | ✅ |
| `paid` | ✅ | ✅ (in `isOverdue`) | ✅ |
| `overdue` | ✅ | ❌ | ✅ |
| `cancelled` | ✅ | ❌ | ✅ |
| `disputed` | ✅ | ❌ | ❌ |
| `unpaid` | ❌ | ✅ (default) | ❌ |

### F.5 LR Status

| Value | Backend | Flutter | React |
|---|---|---|---|
| `draft` | ✅ | ❌ | ✅ |
| `generated` | ✅ | ❌ | ✅ |
| `in_transit` | ✅ | ❌ | ✅ |
| `delivered` | ✅ | ❌ | ✅ |
| `pod_received` | ✅ | ❌ | ✅ |
| `pod_verified` | ❌ | ❌ | ✅ |
| `cancelled` | ✅ | ❌ | ✅ |

### F.6 Expense Category

| Value | Backend | Flutter | React |
|---|---|---|---|
| `fuel` | ✅ | ❌ | ✅ |
| `toll` | ✅ | ❌ | ✅ |
| `food` | ✅ | ❌ | ❌ |
| `parking` | ✅ | ❌ | ❌ |
| `loading` | ✅ | ❌ | ✅ |
| `unloading` | ✅ | ❌ | ✅ |
| `police` | ✅ | ❌ | ❌ (`police` in backend) |
| `rto` | ✅ | ❌ | ✅ |
| `repair` | ✅ | ❌ | ✅ |
| `tyre` | ✅ | ❌ | ❌ |
| `misc` | ✅ | ❌ | ❌ |
| `advance` | ✅ | ❌ | ❌ |
| `driver_allowance` | ❌ | ❌ | ✅ |
| `challan` | ❌ | ❌ | ✅ |
| `other` | ❌ | ❌ | ✅ |

---

## Section G — Summary

### G.1 Issue Counts by Severity

| Severity | Flutter | React | Total |
|---|---|---|---|
| **CRASH** (app crash / 404 / 405) | 7 | 2 | **9** |
| **FEATURE BROKEN** (feature non-functional) | 5 | 6 | **11** |
| **WRONG DATA** (field shows null/wrong value) | 39 | 33 | **72** |
| **WARNING** (might work with compat layer) | 3 | 16 | **19** |
| **Total** | 54 | 57 | **111** |

### G.2 Top 10 Critical Fixes (Ordered by Impact)

| Rank | ID | Layer | Issue | Impact |
|---|---|---|---|---|
| 1 | B14–B15 | **Flutter** | `User.fromJson` reads `username` and `full_name` — backend returns `first_name`/`last_name` | User name always blank across ALL Flutter screens |
| 2 | B1–B3 | **Flutter** | Dashboard endpoints (`/dashboard/fleet-manager`, `/accountant`, `/associate`) don't exist | All 3 role dashboards crash on load |
| 3 | B53–B54 | **Flutter** | All list endpoints try list-cast but backend returns paginated `{items, total}` object | Every list screen crashes or shows empty |
| 4 | B17–B24 | **Flutter** | Job model field names don't match (`origin` vs `origin_city`, `date` vs `job_date`, etc.) | Job list shows blank origin, destination, date, freight |
| 5 | B32 | **Flutter** | LR `ewb_number` vs backend `eway_bill_number` | `hasEwb` always false; EWB filter broken |
| 6 | C26 | **React** | `ContractType` completely wrong (`per_trip` vs `spot`, `contract`, `dedicated`) | Job creation sends invalid contract types |
| 7 | C24–C25 | **React** | `JobStatus` has `assigned` (not in backend), `JobPriority` has `medium` vs `normal` | Status filters and dropdowns contain invalid values |
| 8 | B35–B38 | **Flutter** | Invoice `paid_amount` vs `amount_paid`, `line_items` vs `items`, `gst_breakdown` vs flat fields | Invoice detail screen shows no GST, no line items, wrong balance |
| 9 | C4–C6, D24–D26 | **React** | E-way bill generate/cancel/extend use `/{id}/action` but backend uses `/api/action` | E-way bill operations all 404 |
| 10 | B4–B5 | **Flutter** | Expense filtering/approval endpoints don't exist | Fleet/accountant expense approval workflows completely broken |

### G.3 Root Cause Analysis

1. **Naming Convention Drift**: Backend uses snake_case with full names (`origin_city`, `amount_paid`, `vehicle_type`, `odometer_reading`). Flutter models use abbreviated/different names (`origin`, `paid_amount`, `type`, `odometer_km`). React types are closer but still diverge on ~30 fields.

2. **Response Structure Mismatch**: Backend wraps ALL responses in `APIResponse { success, data, message }` with paginated lists as `{ items, total, page, limit }`. Flutter `ApiService` methods (`getJobs`, `getLRs`, etc.) try to unwrap but assume `data` is a list or fall through to raw response. Need consistent unwrapping.

3. **Enum Divergence**: No shared source of truth for status enums. Backend defines them as Python Enums in SQLAlchemy models. React defines them as TypeScript union types. Flutter hardcodes default strings. All three disagree on valid values for Job, Trip, Vehicle, Invoice, and Expense statuses.

4. **Missing API Aliases**: Flutter was built against expected simple paths (`/dashboard/fleet-manager`, `/expenses/{id}/status`) that the backend never implemented. The backend's compat/alias layers cover many React needs but not Flutter's paths.

5. **Schema vs Client Model Gap**: Flutter models are simplified "view" models (10–15 fields) while backend schemas return 25–40 fields. Many backend fields are simply not parsed. Conversely, Flutter models have fields (`goodsDescription`, `riskType`, `numberOfPackages`) that don't exist in backend schemas.

### G.4 Recommended Fix Order

1. **Add Flutter dashboard aliases** in compat.py → unblocks 3 main screens
2. **Fix Flutter `User.fromJson`** to read `first_name`/`last_name` → unblocks user display everywhere
3. **Fix Flutter `ApiService` response unwrapping** → unblocks all list screens
4. **Align Flutter model field keys** to match backend snake_case → fixes 30+ null fields
5. **Add missing expense/tyre/service Flutter path aliases** in backend
6. **Fix React e-way bill paths** (`/api/generate` etc.)
7. **Align all enum values** across three layers (single source of truth document)
8. **Fix React field name mismatches** (`paid_amount` → `amount_paid`, etc.)
9. **Add missing fleet manager sub-endpoints** in backend or redirect from compat
10. **Fix HTTP method mismatches** (PATCH → POST for status changes, PUT → POST for assign)
