# Complete API Route Inventory — Kavya Transport ERP
> Base prefix for all routes: `settings.API_V1_PREFIX` (e.g. `/api/v1`)  
> All routes are `Bearer <JWT>` authenticated unless noted as **public**.  
> Response envelope: `{ success, data, message, pagination? }` (APIResponse)

---

## Legend
- **Permission** column shows `require_permission(Permissions.X)` or role guard used.
- `get_current_user` = any authenticated user, no specific permission check.
- Routes from `compat.py` / `aliases.py` have **no router prefix** (paths are exact).

---

## 1. Authentication — prefix `/auth`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/auth/login` | `email`, `password` | `access_token`, `refresh_token`, `token_type`, `user{id,email,name,roles,permissions,avatar_url,redirect_to}` | Public |
| POST | `/auth/refresh` | `refresh_token` | `access_token`, `token_type` | Public |
| GET | `/auth/me` | — | Full user profile + permissions | `get_current_user` |
| PUT | `/auth/me/photo` | `avatar_url` | success message | `get_current_user` |
| POST | `/auth/change-password` | `current_password`, `new_password` | success message | `get_current_user` |
| POST | `/auth/logout` | — | success message | `get_current_user` |

---

## 2. Users — prefix `/users`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/users` | query: `page`, `limit`, `search` | User list | `USER_READ` |
| GET | `/users/{user_id}` | — | User detail + roles | `get_current_user` |
| POST | `/users` | `email`, `password`, `first_name`, `last_name`, `phone`, `roles[]` | `{id, email}` | `USER_CREATE` |
| PUT | `/users/{user_id}` | UserUpdate fields | success | `USER_UPDATE` |
| DELETE | `/users/{user_id}` | — | success | `USER_DELETE` |
| PATCH | `/users/me/fcm-token` | `fcm_token` | success | `get_current_user` |
| POST | `/users/{user_id}/reset-password` | `new_password` | success | admin role |

---

## 3. Admin — prefix `/admin`

### From `admin.py`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/admin/health` | — | `{postgresql, mongodb, redis, celery}` | admin role |
| GET | `/admin/trips/pending-completion` | — | Trips list | `TRIP_UPDATE` + admin/fleet_manager |
| POST | `/admin/trips/{trip_id}/approve-completion` | — | `{payment_number, amount}` | `TRIP_UPDATE` + admin/fleet_manager |

### From `admin_dashboard.py`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/admin/dashboard/stats` | — | `{active_trips, month_revenue, compliance_alerts, active_employees, pending_assignment, overdue_amount, total_vehicles, active_drivers}` | `REPORT_VIEW` |
| GET | `/admin/dashboard/role-health` | — | Role health cards | `REPORT_VIEW` |
| GET | `/admin/compliance/alerts` | query: `severity`, `category` | Alerts list | `COMPLIANCE_READ` |
| GET | `/admin/finance/summary` | — | `{month_revenue, total_receivables, total_payables, overdue_amount, receivables_aging{}}` | `REPORT_VIEW` |
| GET | `/admin/finance/payables-summary` | — | Payables by category | `REPORT_VIEW` |
| PATCH | `/admin/vehicles/{vehicle_id}/compliance` | query: `compliance_type`, `renewed_date`, `expiry_date` | success | `VEHICLE_UPDATE` |

---

## 4. Clients — prefix `/clients`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/clients` | query: `page`, `limit`, `search`, `status` | Client list | `CLIENT_READ` |
| GET | `/clients/{client_id}` | — | Client detail + contacts | `get_current_user` |
| POST | `/clients` | ClientCreate fields | `{id, code}` | `CLIENT_CREATE` |
| PUT | `/clients/{client_id}` | ClientUpdate fields | success | `CLIENT_UPDATE` |
| DELETE | `/clients/{client_id}` | — | success | `CLIENT_DELETE` |
| GET | `/clients/{client_id}/contacts` | — | Contacts list | `get_current_user` |
| POST | `/clients/{client_id}/contacts` | `name`, `phone`, `email`, `designation` | `{id}` | `get_current_user` |
| DELETE | `/clients/contacts/{contact_id}` | — | success | `get_current_user` |

---

## 5. Vehicles — prefix `/vehicles`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/vehicles` | query: `page`, `limit`, `search`, `status`, `vehicle_type` | Vehicle list + expiry_alerts | `VEHICLE_READ` |
| GET | `/vehicles/summary` | — | Fleet summary stats | `get_current_user` |
| GET | `/vehicles/expiring` | query: `days` | Expiring vehicles | `get_current_user` |
| GET | `/vehicles/{vehicle_id}` | — | Vehicle detail + expiry_alerts | `get_current_user` |
| POST | `/vehicles` | VehicleCreate fields | `{id, registration_number}` | `VEHICLE_CREATE` |
| PUT | `/vehicles/{vehicle_id}` | VehicleUpdate fields | success | `VEHICLE_UPDATE` |
| DELETE | `/vehicles/{vehicle_id}` | — | success | `VEHICLE_DELETE` |

---

## 6. Drivers — prefix `/drivers`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/drivers/dashboard` | — | Driver stats | `get_current_user` |
| GET | `/drivers` | query: `page`, `limit`, `search`, `status` | Driver list + license info | `DRIVER_READ` |
| GET | `/drivers/{driver_id}` | — | Driver detail + licenses + name | `get_current_user` |
| POST | `/drivers` | DriverCreate fields | `{id, employee_code, user_id, login_email, login_password}` | `DRIVER_CREATE` |
| PUT | `/drivers/{driver_id}` | DriverUpdate fields | success | `DRIVER_UPDATE` |
| DELETE | `/drivers/{driver_id}` | — | success | `DRIVER_DELETE` |
| PUT | `/drivers/{driver_id}/pin` | `pin` (6-digit) | success | `DRIVER_UPDATE` |
| POST | `/drivers/verify-pin` | `pin` | success | `get_current_user` |
| GET | `/drivers/{driver_id}/payment-info` | — | `{upi_id, bank_account_number, bank_name, bank_ifsc}` | `DRIVER_READ` |
| GET | `/drivers/{driver_id}/licenses` | — | License list | `get_current_user` |
| POST | `/drivers/{driver_id}/licenses` | DriverLicenseCreate fields | `{id}` | `get_current_user` |
| GET | `/drivers/{driver_id}/trips` | query: `page`, `page_size` | Trip list + summary | `get_current_user` |
| GET | `/drivers/{driver_id}/behaviour` | query: `period` | Behaviour analytics | `get_current_user` |
| GET | `/drivers/{driver_id}/documents` | — | Docs list + compliance | `get_current_user` |
| GET | `/drivers/{driver_id}/performance` | — | Performance scores + trend | `get_current_user` |
| GET | `/drivers/{driver_id}/attendance` | query: `month` (YYYY-MM) | Monthly attendance | `get_current_user` |
| GET | `/drivers/me/trips` | query: `page`, `page_size` | Own trip list | `get_current_user` |
| GET | `/drivers/me/trips/{trip_id}` | — | Trip detail + LR details | `get_current_user` |
| PUT | `/drivers/me/trips/{trip_id}/complete` | `end_odometer`, `remarks` | success | `TRIP_COMPLETE` |
| GET | `/drivers/me/vehicle` | — | Allocated vehicle + documents | `get_current_user` |
| GET | `/drivers/me/documents` | — | Own documents | `get_current_user` |
| POST | `/drivers/me/documents/upload` | `file` (form), `document_type`, `document_number` | `{id, file_url, document_type}` | `get_current_user` |
| PUT | `/drivers/me/documents/{doc_id}` | `file` (form), `document_number` | `{id, file_url, document_type}` | `get_current_user` |

---

## 7. Jobs — prefix `/jobs`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/jobs` | query: `page`, `limit`, `search`, `status`, `client_id` | Job list | `JOB_READ` |
| GET | `/jobs/{job_id}` | — | Job + client name | `get_current_user` |
| POST | `/jobs` | JobCreate fields | `{id, job_number}` | `JOB_CREATE` |
| PUT | `/jobs/{job_id}` | JobUpdate fields | success | `JOB_UPDATE` |
| DELETE | `/jobs/{job_id}` | — | success | `JOB_DELETE` |
| POST | `/jobs/{job_id}/submit-for-approval` | — | success | `JOB_UPDATE` |
| POST | `/jobs/{job_id}/status` | `status`, `remarks` | success | `JOB_UPDATE` |
| PUT | `/jobs/{job_id}/assign` | `vehicle_id`, `driver_id` | `{id, trip_id}` | `JOB_UPDATE` |
| GET | `/jobs/lookup/clients` | query: `search` | Clients list | `get_current_user` |
| GET | `/jobs/lookup/routes` | query: `search` | Routes list | `get_current_user` |
| GET | `/jobs/lookup/vehicle-types` | — | Vehicle types | `get_current_user` |
| GET | `/jobs/lookup/states` | — | States list | `get_current_user` |
| GET | `/jobs/next-job-number` | — | `{job_number}` | `get_current_user` |

---

## 8. Lorry Receipts — prefix `/lr`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/lr` | query: `page`, `limit`, `search`, `status`, `job_id`, `trip_id` | LR list | `LR_READ` |
| GET | `/lr/{lr_id}` | — | LR detail | `get_current_user` |
| POST | `/lr` | LRCreate fields | `{id, lr_number}` | `LR_CREATE` |
| PUT | `/lr/{lr_id}` | LRUpdate fields | success | `LR_UPDATE` |
| DELETE | `/lr/{lr_id}` | — | success | `LR_DELETE` |
| POST | `/lr/{lr_id}/status` | `status`, `remarks`, `received_by` | success | `LR_UPDATE` |
| POST | `/lr/{lr_id}/generate` | — | LR detail | `LR_UPDATE` |
| GET | `/lr/{lr_id}/pdf` | — | `{url, source}` | `LR_READ` |
| GET | `/lr/{lr_id}/pdf/download` | — | PDF binary stream | `LR_READ` |

---

## 9. E-way Bills — prefix `/eway-bills`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/eway-bills` | query: `page`, `limit`, `search`, `status` | EWB list | `EWAY_BILL_READ` |
| GET | `/eway-bills/{eway_id}` | — | EWB detail | `EWAY_BILL_READ` |
| POST | `/eway-bills` | EwayBillCreate fields | `{id}` | `EWAY_BILL_CREATE` |
| PUT | `/eway-bills/{eway_id}` | EwayBillUpdate fields | success | `EWAY_BILL_UPDATE` |
| GET | `/eway-bills/active` | — | Active EWBs list | `EWAY_BILL_READ` |
| GET | `/eway-bills/expiring` | query: `hours` | Expiring EWBs | `EWAY_BILL_READ` |
| GET | `/eway-bills/trip/{trip_id}/compliance` | — | Compliance result | `EWAY_BILL_READ` |
| GET | `/eway-bills/validity-calculator` | query: `distance_km`, `is_odc` | `{distance_km, validity_hours}` | `get_current_user` |
| POST | `/eway-bills/{eway_id}/cancel` | `reason` | success | `EWAY_BILL_UPDATE` |
| POST | `/eway-bills/{eway_id}/extend` | `vehicle_number`, `additional_distance_km`, `reason` | `{valid_until}` | `EWAY_BILL_UPDATE` |
| POST | `/eway-bills/api/generate` | dict payload | API result | `EWAY_BILL_CREATE` |
| POST | `/eway-bills/api/cancel` | `ewb_number`, `reason`, `reason_code` | API result | `EWAY_BILL_UPDATE` |
| POST | `/eway-bills/api/extend` | `ewb_number`, `vehicle_no`, `remaining_distance`, `reason`, `reason_code` | API result | `EWAY_BILL_UPDATE` |
| GET | `/eway-bills/api/details/{ewb_number}` | — | EWB details from govt | `EWAY_BILL_READ` |

---

## 10. Trips — prefix `/trips`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/trips` | query: `page`, `limit`, `search`, `status`, `vehicle_id`, `driver_id` | Trip list | `TRIP_READ` |
| GET | `/trips/{trip_id}` | — | Trip detail | `TRIP_READ` |
| POST | `/trips` | TripCreate fields | `{id, trip_number}` | `TRIP_CREATE` |
| PUT | `/trips/{trip_id}` | TripUpdate fields | success | `TRIP_UPDATE` |
| DELETE | `/trips/{trip_id}` | — | success | `TRIP_DELETE` |
| PATCH | `/trips/{trip_id}/status` | `status`, `remarks`, `odometer_reading`, `latitude`, `longitude`, `location_name` | success | `TRIP_UPDATE` |
| PUT | `/trips/{trip_id}/start` | `start_odometer` | `{id}` | `TRIP_UPDATE` |
| PUT | `/trips/{trip_id}/reach` | — | `{id}` | `TRIP_UPDATE` |
| PUT | `/trips/{trip_id}/close` | `end_odometer` | `{id}` | `TRIP_UPDATE` |
| POST | `/trips/{trip_id}/approve-payment` | — | `{payment_id, payment_number, amount}` | `TRIP_UPDATE` |
| GET | `/trips/{trip_id}/checklist` | query: `type` | Checklist data | `TRIP_READ` |
| POST | `/trips/{trip_id}/checklist` | `type`, `items[]`, `notes` | `{ok_count, total, status}` | `TRIP_READ` |
| POST | `/trips/{trip_id}/sos` | `latitude`, `longitude`, `location_name` | `{event_id, trip_id, driver_name, vehicle_registration, emergency_contact_*}` | `SOS_TRIGGER` |
| POST | `/trips/{trip_id}/epod` | — | `{url, source}` | `TRIP_READ` |
| GET | `/trips/{trip_id}/epod/download` | — | PDF binary stream | `TRIP_READ` |
| GET | `/trips/{trip_id}/expenses` | — | Expense list | `EXPENSE_READ` |
| POST | `/trips/{trip_id}/expenses` | TripExpenseCreate fields (`category`, `amount`, `payment_mode`, `biometric_verified`) | `{id}` | `EXPENSE_CREATE` |
| POST | `/trips/expenses/{expense_id}/verify` | — | success | `EXPENSE_VERIFY` |
| POST | `/trips/expenses/ocr` | `file` (image/form) | `{amount, date, vendor, category}` | `EXPENSE_CREATE` |

---

## 11. Tracking — prefix `/tracking`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/tracking/live` | — | All active trips with GPS coords | `TRACKING_LIVE` or `TRACKING_VIEW` |
| POST | `/tracking/gps/ping` | `vehicle_id`, `registration_number`, `latitude`, `longitude`, `speed`, `heading`, `odometer`, `ignition_on`, `trip_id` | `{vehicle_id, registration_number, latitude, longitude, recorded}` | `GPS_PING_CREATE` |
| GET | `/tracking/active-trips` | — | Active trips list | `TRACKING_VIEW` or `TRIP_READ` |
| GET | `/tracking/trip/{trip_id}` | — | Trip tracking data | `TRACKING_VIEW` or `TRIP_READ` |
| GET | `/tracking/vehicle/{vehicle_id}` | — | Vehicle tracking data | `TRACKING_VIEW` or `VEHICLE_READ` |
| GET | `/tracking/alerts` | query: `severity` | Tracking alerts list | `get_current_user` |
| POST | `/tracking/alerts/{alert_id}/acknowledge` | — | `{id, acknowledged}` | `get_current_user` |
| GET | `/tracking/gps/positions` | — | Live GPS positions (MongoDB) | `get_current_user` |
| GET | `/tracking/gps/path/{vehicle_id}` | query: `hours` | GPS path/trail | `get_current_user` |
| GET | `/tracking/tiles/{z}/{x}/{y}` | — | OSM map tile (proxy) | Public |

---

## 12. Market Trips — prefix `/market-trips`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/market-trips` | query: `page`, `limit`, `search`, `status`, `supplier_id` | Market trips list | `get_current_user` |
| GET | `/market-trips/{trip_id}` | — | Market trip detail | `get_current_user` |
| POST | `/market-trips` | MarketTripCreate fields | `{id}` | `get_current_user` |
| PUT | `/market-trips/{trip_id}` | MarketTripUpdate fields | success | `get_current_user` |
| PUT | `/market-trips/{trip_id}/assign` | MarketTripAssign fields | success | `get_current_user` |
| PUT | `/market-trips/{trip_id}/start` | — | success | `get_current_user` |
| PUT | `/market-trips/{trip_id}/deliver` | — | success | `get_current_user` |
| POST | `/market-trips/{trip_id}/settle` | `settlement_reference`, `settlement_remarks` | success | `get_current_user` |
| PUT | `/market-trips/{trip_id}/cancel` | — | success | `get_current_user` |
| GET | `/market-trips/{trip_id}/pnl` | — | P&L data | `get_current_user` |

---

## 13. Finance — prefix `/finance`

### From `finance.py`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/finance/invoices` | query: `page`, `limit`, `search`, `status`, `client_id` | Invoice list | `INVOICE_READ` |
| GET | `/finance/invoices/{invoice_id}` | — | Invoice detail | `get_current_user` |
| POST | `/finance/invoices` | InvoiceCreate fields | `{id, invoice_number}` | `INVOICE_CREATE` |
| PUT | `/finance/invoices/{invoice_id}` | InvoiceUpdate fields | success | `INVOICE_UPDATE` |
| DELETE | `/finance/invoices/{invoice_id}` | — | success | `INVOICE_DELETE` |
| POST | `/finance/invoices/{invoice_id}/send` | — | success | `INVOICE_UPDATE` |
| POST | `/finance/invoices/{invoice_id}/mark-paid` | — | `{payment_id, payment_number}` | `INVOICE_UPDATE` |
| POST | `/finance/invoices/generate-from-trip/{trip_id}` | — | `{id, invoice_number}` | `INVOICE_CREATE` |
| GET | `/finance/payments` | query: `page`, `limit`, `payment_type`, `client_id` | Payment list | `PAYMENT_READ` |
| POST | `/finance/payments` | PaymentCreate fields | `{id, payment_number}` | `PAYMENT_CREATE` |
| GET | `/finance/ledger` | query: `page`, `limit`, `ledger_type`, `client_id`, `date_from`, `date_to` | Ledger entries | `LEDGER_READ` |
| POST | `/finance/ledger` | LedgerEntryCreate fields | `{id, entry_number}` | `get_current_user` |
| GET | `/finance/vendors` | query: `page`, `limit`, `search` | Vendors list | `get_current_user` |
| POST | `/finance/vendors` | VendorCreate fields | `{id}` | `get_current_user` |
| GET | `/finance/bank-accounts` | — | Bank accounts list | `get_current_user` |
| POST | `/finance/bank-accounts` | BankAccountCreate fields | `{id}` | `get_current_user` |
| GET | `/finance/bank-transactions` | query: `account_id`, `page`, `limit` | Transactions list | `get_current_user` |
| POST | `/finance/bank-transactions` | BankTransactionCreate fields | `{id}` | `get_current_user` |
| GET | `/finance/routes` | query: `page`, `limit`, `search` | Routes list | `get_current_user` |
| GET | `/finance/routes/{route_id}` | — | Route detail | `get_current_user` |
| POST | `/finance/routes` | RouteCreate fields | `{id, route_code}` | `get_current_user` |
| PUT | `/finance/routes/{route_id}` | RouteUpdate fields | success | `get_current_user` |

### From `finance_automation.py` (also under `/finance`)

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/finance/payment-links` | `invoice_id` | `{id, short_url, amount}` | `PAYMENT_CREATE` |
| GET | `/finance/payment-links` | query: `page`, `limit`, `invoice_id`, `status` | Links list | `PAYMENT_READ` |
| POST | `/finance/payment-links/{link_id}/resend` | — | success | `PAYMENT_CREATE` |
| POST | `/finance/bank-statements/import` | query: `account_id`; `file` (.csv) | `{id, line_count}` | `BANKING_IMPORT` |
| POST | `/finance/bank-statements/{statement_id}/reconcile` | — | Reconciliation summary | `BANKING_RECONCILE` |
| GET | `/finance/bank-statements/{statement_id}/summary` | — | Reconciliation summary | `BANKING_READ` |
| GET | `/finance/bank-statements/{statement_id}/lines` | query: `status`, `page`, `limit` | Statement lines list | `BANKING_READ` |
| POST | `/finance/bank-statements/lines/{line_id}/match` | `payment_id`, `invoice_id` | success | `BANKING_RECONCILE` |
| POST | `/finance/bank-statements/lines/{line_id}/ignore` | — | success | `BANKING_RECONCILE` |
| POST | `/finance/settlements` | `driver_id`, `period_from`, `period_to` | `{id, settlement_number, net_payable}` | `SETTLEMENT_CREATE` |
| GET | `/finance/settlements` | query: `page`, `limit`, `driver_id`, `status` | Settlements list | `SETTLEMENT_READ` |
| POST | `/finance/settlements/{settlement_id}/approve` | — | success | `SETTLEMENT_APPROVE` |
| POST | `/finance/settlements/{settlement_id}/pay` | — | success | `SETTLEMENT_APPROVE` |
| POST | `/finance/supplier-payables` | `vendor_id`, `description`, `amount`, `due_date`, `reference_number` | `{id, payable_number}` | `PAYMENT_CREATE` |
| GET | `/finance/supplier-payables` | query: `page`, `limit`, `vendor_id`, `status` | Payables list | `PAYMENT_READ` |
| POST | `/finance/supplier-payables/{payable_id}/pay` | — | success | `PAYMENT_CREATE` |
| GET | `/finance/fastag` | query: `page`, `limit`, `vehicle_id`, `trip_id`, `date_from`, `date_to` | FASTag transactions | `BANKING_READ` |
| GET | `/finance/alerts` | query: `page`, `limit`, `is_read`, `severity` | Finance alerts | `INVOICE_READ` |
| POST | `/finance/alerts/{alert_id}/read` | — | success | `get_current_user` |
| POST | `/finance/alerts/{alert_id}/resolve` | — | success | `get_current_user` |
| GET | `/finance/reports/daily-digest` | query: `report_date` | Daily digest | `INVOICE_READ` |
| GET | `/finance/reports/weekly-pl` | query: `week_ending` | Weekly P&L | `INVOICE_READ` |
| GET | `/finance/reports/monthly-close` | query: `year`, `month` | Monthly close report | `INVOICE_READ` |
| GET | `/finance/reports/gstr1` | query: `year`, `month` | GSTR-1 data | `INVOICE_READ` |
| GET | `/finance/automation/duplicate-check` | query: `client_id`, `trip_id` | `{has_duplicates, count, invoice_ids[]}` | `INVOICE_READ` |
| GET | `/finance/automation/freight-leakage/{invoice_id}` | — | Leakage analysis | `INVOICE_READ` |
| GET | `/finance/automation/partial-payments` | — | Partial payment invoices | `INVOICE_READ` |

---

## 14. Payables — prefix `/payables`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/payables/driver/{user_id}` | — | Driver settlements list | `get_current_user` |
| GET | `/payables/` | query: `type`, `status` | All settlements | `get_current_user` |
| PATCH | `/payables/{settlement_id}/approve` | — | success | `get_current_user` |
| PATCH | `/payables/{settlement_id}/reject` | — | success | `get_current_user` |
| PATCH | `/payables/{settlement_id}/mark-paid` | `payment_method`, `paid_date` | success | `get_current_user` |

---

## 15. Receivable Payments — no prefix (exact paths)

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/clients/{client_id}/payment-info` | — | `{upi_id, phone, upi_available}` | `PAYMENT_READ` |
| POST | `/receivables/record-payment` | `invoice_id`, `amount_paid`, `payment_mode`, `reference_number`, `upi_txn_id`, `paid_date` | Payment record | `PAYMENT_CREATE` |
| GET | `/receivables/{invoice_id}/payments` | — | Payment history list | `PAYMENT_READ` |

---

## 16. Banking — prefix `/banking`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/banking/accounts` | — | Bank accounts list | `BANKING_READ` |
| POST | `/banking/entries` | BankingEntryCreate fields | `{id, entry_no}` | `BANKING_RECONCILE` |
| GET | `/banking/entries` | query: `page`, `limit`, `account_id`, `entry_type`, `date_from`, `date_to`, `reconciled`, `search` | Entries list | `BANKING_READ` |
| GET | `/banking/entries/{entry_id}` | — | Entry detail | `BANKING_READ` |
| PUT | `/banking/entries/{entry_id}` | BankingEntryUpdate fields | success | `BANKING_RECONCILE` |
| DELETE | `/banking/entries/{entry_id}` | — | success | `BANKING_RECONCILE` |
| GET | `/banking/balance` | — | Per-account balance + total | `BANKING_READ` |
| GET | `/banking/balance/history` | query: `account_id`, `days` | Daily balance history | `BANKING_READ` |
| POST | `/banking/reconciliation/import` | query: `account_id`; `file` (.csv) | `{import_id, filename, row_count, preview_rows[]}` | `BANKING_IMPORT` |
| GET | `/banking/reconciliation` | query: `import_id`, `match_status`, `page`, `limit` | CSV transactions | `BANKING_READ` |
| POST | `/banking/reconciliation/match` | `csv_transaction_id`, `invoice_id`, `entry_id` | success | `BANKING_RECONCILE` |
| GET | `/banking/reconciliation/exceptions` | query: `import_id`, `page`, `limit` | Exception queue | `BANKING_READ` |

---

## 17. Accountant — prefix `/accountant`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/accountant/dashboard` | — | Dashboard KPIs | `get_current_user` |
| GET | `/accountant/invoices` | query: `page`, `limit`, `search`, `status`, `client_id` | Invoice list | `INVOICE_READ` |
| POST | `/accountant/invoices` | dict | Invoice detail | `INVOICE_READ` |
| PUT | `/accountant/invoices/{invoice_id}` | dict | Invoice detail | `INVOICE_READ` |
| DELETE | `/accountant/invoices/{invoice_id}` | — | success | `INVOICE_READ` |
| GET | `/accountant/payments` | query: `page`, `limit`, `payment_type`, `client_id` | Payment list | `PAYMENT_READ` |
| POST | `/accountant/payments` | dict | Payment row | `PAYMENT_READ` |
| GET | `/accountant/ledger` | query: `page`, `limit`, `ledger_type`, `client_id`, `date_from`, `date_to` | Ledger entries | `LEDGER_READ` |
| GET | `/accountant/receivables` | — | Receivable invoices | `INVOICE_READ` |
| GET | `/accountant/expenses` | query: `page`, `limit`, `verified`, `status` | Expenses list | `EXPENSE_READ` |
| PUT | `/accountant/expenses/{expense_id}` | dict (amount, description, payment_mode…) | success | `EXPENSE_UPDATE` |
| DELETE | `/accountant/expenses/{expense_id}` | — | success | `EXPENSE_DELETE` |
| PUT | `/accountant/expenses/{expense_id}/approve` | — | success | `EXPENSE_APPROVE` |
| PUT | `/accountant/expenses/{expense_id}/reject` | — | success | `EXPENSE_APPROVE` |
| PUT | `/accountant/expenses/{expense_id}/mark-paid` | — | success | `EXPENSE_APPROVE` |
| GET | `/accountant/banking` | — | Bank accounts list | `PAYMENT_READ` or `LEDGER_READ` |

---

## 18. Dashboard — prefix `/dashboard`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/dashboard` | — | Dashboard stats | `get_current_user` |
| GET | `/dashboard/overview` | — | Same as root | `get_current_user` |
| GET | `/dashboard/fleet-stats` | — | Fleet summary | `get_current_user` |
| GET | `/dashboard/trip-stats` | — | Trip status distribution | `get_current_user` |
| GET | `/dashboard/finance-stats` | — | Finance KPIs | `get_current_user` |
| GET | `/dashboard/notifications` | — | User alerts | `get_current_user` |
| POST | `/dashboard/notifications/{notification_id}/read` | — | `{marked}` | `get_current_user` |
| GET | `/dashboard/charts/revenue-trend` | query: `period` | Revenue chart data | `get_current_user` |
| GET | `/dashboard/charts/expense-breakdown` | — | Expense breakdown | `get_current_user` |
| GET | `/dashboard/charts/fleet-utilization` | — | Fleet utilization data | `get_current_user` |
| GET | `/dashboard/revenue-chart` | — | Revenue chart (legacy) | `get_current_user` |
| GET | `/dashboard/trip-status` | — | Trip status (legacy) | `get_current_user` |
| GET | `/dashboard/top-clients` | — | Top clients (legacy) | `get_current_user` |
| GET | `/dashboard/expense-breakdown` | — | Expense breakdown (legacy) | `get_current_user` |
| GET | `/dashboard/pa/kpis` | query: `date_filter`, `from_date`, `to_date` | PA KPIs | `get_current_user` |
| GET | `/dashboard/pa/action-center` | — | PA pending tasks | `get_current_user` |
| GET | `/dashboard/pa/job-pipeline` | — | Job pipeline counts | `get_current_user` |
| GET | `/dashboard/pa/recent-activity` | query: `limit` | Activity log | `get_current_user` |
| GET | `/dashboard/pa/banking-status` | — | Banking status | `get_current_user` |
| GET | `/dashboard/pa/fleet-status` | — | Fleet status | `get_current_user` |
| GET | `/dashboard/pa/compliance-alerts` | — | Compliance alerts | `get_current_user` |
| GET | `/dashboard/pa/trip-workflow` | — | Trip workflow status | `get_current_user` |
| GET | `/dashboard/pa/system-alerts` | — | System alerts | `get_current_user` |
| GET | `/dashboard/pa/revenue-snapshot` | query: `period` | Revenue snapshot | `get_current_user` |
| GET | `/dashboard/branch` | query: `branch_id` | Branch dashboard summary | `get_current_user` |

---

## 19. PA Dashboard — prefix `/pa/dashboard`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/pa/dashboard/stats` | — | `{jobs_awaiting_lr, ewb_expiring, trips_in_transit, pods_pending, earliest_ewb_id, hours_until_expiry}` | `TRIP_READ` |
| GET | `/pa/dashboard/priority-actions` | — | Top 5 priority job cards | `TRIP_READ` |

---

## 20. Manager Dashboard — prefix `/manager/dashboard`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/manager/dashboard/stats` | — | `{active_trips, pending_assignment, monthly_revenue, approvals_needed, overdue_service_count}` | `JOB_READ` |
| GET | `/manager/dashboard/revenue-sparkline` | — | 7-day daily revenue + pct_change | `REPORT_VIEW` |
| GET | `/manager/dashboard/approvals` | query: `type` (all/expenses/banking) | Pending approvals list | `EXPENSE_APPROVE` |

---

## 21. Fleet Manager — prefix `/fleet`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/fleet/dashboard` | — | Fleet dashboard KPIs | `get_current_user` |
| GET | `/fleet/vehicles` | query: `page`, `limit`, `search`, `status` | Vehicles list | `get_current_user` |
| GET | `/fleet/trips` | query: `page`, `limit`, `status` | Trips list | `get_current_user` |
| GET | `/fleet/expiring-documents` | query: `days` | Expiring docs list | `get_current_user` |

---

## 22. Reports — prefix `/reports`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/reports/dashboard` | — | Summary KPIs | `REPORT_VIEW` |
| GET | `/reports/summary` | query: `period` | Period summary | `REPORT_VIEW` |
| GET | `/reports/revenue-chart` | query: `days` | Revenue chart data | `REPORT_VIEW` |
| GET | `/reports/trip-status` | — | Trip status distribution | `REPORT_VIEW` |
| GET | `/reports/top-clients` | query: `limit` | Top clients | `REPORT_VIEW` |
| GET | `/reports/expense-breakdown` | query: `days` | Expense breakdown | `REPORT_VIEW` |
| GET | `/reports/trip-summary` | query: `from` (date), `to` (date) | Trip-level P&L data | `REPORT_VIEW` |
| GET | `/reports/vehicle-performance` | query: `from`, `to` | Vehicle performance metrics | `REPORT_VIEW` |
| GET | `/reports/driver-performance` | query: `from`, `to` | Driver performance metrics | `REPORT_VIEW` |
| GET | `/reports/fuel-analysis` | query: `from`, `to` | Fuel fill records | `REPORT_VIEW` |
| GET | `/reports/revenue-analysis` | query: `from`, `to` | Monthly invoice revenue | `REPORT_VIEW` |
| GET | `/reports/expense-analysis` | query: `from`, `to` | Expenses by category | `REPORT_VIEW` |
| GET | `/reports/route-analysis` | query: `from`, `to` | Route-level trip aggregates | `REPORT_VIEW` |
| GET | `/reports/client-outstanding` | query: `from`, `to` | Client AR aging | `REPORT_VIEW` |
| GET | `/reports/export/{report_type}` | query: `format`, `from`, `to` | CSV file download | `get_current_user` |
| GET | `/reports/branch/summary` | query: `branch_id`, `from`, `to` | Branch-scoped summary | `get_current_user` |

---

## 23. Intelligence — prefix `/intelligence`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/intelligence/driver-scores/{driver_id}` | — | Score summary | `DRIVER_SCORE_READ` |
| GET | `/intelligence/driver-leaderboard` | — | Top/bottom 5 | `DRIVER_SCORE_READ` |
| GET | `/intelligence/vehicle-risk/{vehicle_id}` | — | Risk score | `INTELLIGENCE_VIEW` |
| GET | `/intelligence/fleet-maintenance` | — | Healthy/monitor/high-risk | `INTELLIGENCE_VIEW` |
| GET | `/intelligence/trip-alerts/{trip_id}` | query: `unacknowledged_only` | Alerts list | `INTELLIGENCE_VIEW` |
| POST | `/intelligence/trip-alerts/{alert_id}/acknowledge` | query: `resolution` | Alert detail | `INTELLIGENCE_VIEW` |
| GET | `/intelligence/eta/{trip_id}` | — | Predicted ETA | `GPS_DATA_READ` |
| GET | `/intelligence/route/{trip_id}` | — | Optimal route candidates | `GPS_DATA_READ` |
| POST | `/intelligence/fuel-check/{fuel_issue_id}` | — | Mismatch check result | `INTELLIGENCE_VIEW` |
| POST | `/intelligence/expense-validate/{expense_id}` | — | Fraud validation result | `INTELLIGENCE_VIEW` |
| GET | `/intelligence/insights` | query: `limit` | Daily insights list | `INTELLIGENCE_VIEW` |
| GET | `/intelligence/config` | query: `prefix` | System config values | `SYSTEM_CONFIG_READ` |
| PUT | `/intelligence/config/{key}` | query: `value` | `{key, old_value, new_value}` | `SYSTEM_CONFIG_UPDATE` |
| GET | `/intelligence/audit-logs` | query: `actor_id`, `entity_type`, `action`, `page`, `limit` | Audit log entries | `AUDIT_LOG_READ` |
| GET | `/intelligence/events` | — | Recent role-filtered events | `INTELLIGENCE_VIEW` |

---

## 24. Compliance — prefix `/compliance`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/compliance/alerts` | query: `severity`, `resolved`, `vehicle_id`, `driver_id`, `skip`, `limit` | Alerts list | `COMPLIANCE_READ` |
| GET | `/compliance/alerts/summary` | — | Alert summary | `COMPLIANCE_READ` |
| PUT | `/compliance/alerts/{alert_id}/resolve` | — | Alert detail | `COMPLIANCE_MANAGE` |
| GET | `/compliance/ais140/{vehicle_id}` | — | AIS-140 compliance report | `COMPLIANCE_READ` |
| GET | `/compliance/ais140/report` | — | Fleet AIS-140 report | `COMPLIANCE_READ` |
| GET | `/compliance/events` | query: `driver_id`, `trip_id`, `vehicle_id`, `event_type`, `skip`, `limit` | Driver events | `COMPLIANCE_READ` |
| GET | `/compliance/events/driver/{driver_id}/summary` | — | Driver event summary | `COMPLIANCE_READ` |
| POST | `/compliance/events` | DriverEventCreate fields | Event detail | `COMPLIANCE_MANAGE` |
| GET | `/compliance/audit-notes` | query: `resource_type`, `resource_id`, `status`, `skip`, `limit` | Audit notes | `COMPLIANCE_READ` |
| POST | `/compliance/audit-notes` | AuditNoteCreate fields | Note detail | `COMPLIANCE_MANAGE` |
| PUT | `/compliance/audit-notes/{note_id}/resolve` | — | Note detail | `COMPLIANCE_MANAGE` |

---

## 25. Geofences — prefix `/geofences`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/geofences` | query: `trip_id`, `route_id`, `is_active`, `skip`, `limit` | Geofences list | `get_current_user` |
| GET | `/geofences/{geofence_id}` | — | Geofence detail | `get_current_user` |
| POST | `/geofences` | GeofenceCreate fields | Geofence detail | `get_current_user` |
| PUT | `/geofences/{geofence_id}` | GeofenceUpdate fields | Geofence detail | `get_current_user` |
| DELETE | `/geofences/{geofence_id}` | — | success | `get_current_user` |
| POST | `/geofences/check` | `lat`, `lng`, `vehicle_id` | `{breaches[], total}` | `get_current_user` |
| GET | `/geofences/trip/{trip_id}` | — | Trip geofences | `get_current_user` |

---

## 26. Documents — prefix `/documents`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/documents` | query: `page`, `limit`, `search`, `entity_type` | Documents list | `DOCUMENT_READ` |
| GET | `/documents/lookup/entities` | query: `entity_type`, `search` | Entity list | `DOCUMENT_READ` |
| GET | `/documents/lookup/compliance-categories` | — | Categories list | `DOCUMENT_READ` |
| GET | `/documents/{doc_id}` | — | Document detail | `DOCUMENT_READ` |
| POST | `/documents/upload` | `file` (form), `entity_type`, `entity_id`, `title`, `document_type` | `{id, url, source}` | `DOCUMENT_CREATE` |
| DELETE | `/documents/{doc_id}` | — | success | `DOCUMENT_DELETE` |

---

## 27. Service & Workshops — prefix `/service`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/service` | query: `page`, `limit`, `vehicle_id`, `status` | Service records list | `MAINTENANCE_READ` |
| POST | `/service` | ServiceCreate fields | `{id}` | `MAINTENANCE_CREATE` |
| PUT | `/service/{service_id}` | ServiceUpdate fields | success | `MAINTENANCE_CREATE` |
| DELETE | `/service/{service_id}` | — | success | `MAINTENANCE_CREATE` |
| GET | `/service/analytics/cost` | query: `months` | Cost analytics | `MAINTENANCE_READ` |
| GET | `/service/overdue` | — | Overdue/upcoming service list | `MAINTENANCE_READ` |
| GET | `/service/workshops` | query: `page`, `limit` | Workshops list | `MAINTENANCE_READ` |
| POST | `/service/workshops` | WorkshopCreate fields | `{id}` | `MAINTENANCE_CREATE` |
| PUT | `/service/workshops/{workshop_id}` | WorkshopUpdate fields | success | `MAINTENANCE_CREATE` |
| DELETE | `/service/workshops/{workshop_id}` | — | success | `MAINTENANCE_CREATE` |

---

## 28. Tyre — prefix `/tyre`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/tyre` | query: `page`, `limit`, `vehicle_id` | Tyres list + summary | `VEHICLE_READ` |
| POST | `/tyre` | `serial_number`, `brand`, `size`, `purchase_date`, `cost`, `vehicle_id`, `axle_position`, `status` | `{id}` | `VEHICLE_UPDATE` |
| PUT | `/tyre/{tyre_id}` | TyreUpdate fields | success | `VEHICLE_UPDATE` |
| DELETE | `/tyre/{tyre_id}` | — | success | `VEHICLE_UPDATE` |
| POST | `/tyre/{tyre_id}/event` | `event_type`, `odometer`, `reason` | Event logged | `VEHICLE_UPDATE` |
| POST | `/tyre/{tyre_id}/retread` | `cost`, `vendor_name`, `notes`, `odometer_km` | Retread count/status | `VEHICLE_UPDATE` |
| GET | `/tyre/{tyre_id}/history` | — | Lifecycle events | `VEHICLE_READ` |
| GET | `/tyre/analytics/cost-per-km` | — | Fleet-wide tyre analytics | `VEHICLE_READ` |

---

## 29. TPMS — prefix `/tpms`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/tpms/reading` | `sensor_id`, `psi`, `temperature_c`, `tread_depth_mm` | Ingest result | `get_current_user` |
| GET | `/tpms/vehicle/{vehicle_id}` | — | Per-wheel live TPMS data | `get_current_user` |
| GET | `/tpms/fleet` | — | Fleet-wide tyre health | `get_current_user` |
| GET | `/tpms/alerts` | query: `hours`, `limit` | Active TPMS alerts | `get_current_user` |
| GET | `/tpms/history/{tyre_id}` | query: `hours` | Historical readings | `get_current_user` |
| GET | `/tpms/predict/{vehicle_id}` | — | Next maintenance prediction | `get_current_user` |
| GET | `/tpms/predict-fleet` | — | Fleet-wide maintenance predictions | `get_current_user` |
| GET | `/tpms/tyre-replacement/{vehicle_id}` | — | Tyre replacement date predictions | `get_current_user` |

---

## 30. Fuel Prices — prefix `/fuel-prices`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/fuel-prices` | query: `city` | `{diesel, petrol, city}` | `get_current_user` |
| GET | `/fuel-prices/bulk` | — | All cities fuel prices | `get_current_user` |

---

## 31. Fuel Pump — prefix `/fuel-pump`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/fuel-pump/dashboard` | — | Dashboard stats | `FUEL_READ` or `FUEL_STOCK_VIEW` or `FUEL_REPORTS` |
| GET | `/fuel-pump/tanks` | — | Tanks list | `FUEL_STOCK_VIEW` or `FUEL_READ` |
| POST | `/fuel-pump/tanks` | DepotFuelTankCreate fields | Tank detail | `FUEL_STOCK_EDIT` |
| GET | `/fuel-pump/tanks/{tank_id}` | — | Tank detail | `FUEL_STOCK_VIEW` or `FUEL_READ` |
| PUT | `/fuel-pump/tanks/{tank_id}` | DepotFuelTankUpdate fields | Tank detail | `FUEL_STOCK_EDIT` |
| DELETE | `/fuel-pump/tanks/{tank_id}` | — | success | `FUEL_STOCK_EDIT` |
| POST | `/fuel-pump/issues` | FuelIssueCreate fields | Issue detail + optional theft_alert | `FUEL_ISSUE` or `FUEL_CREATE` |
| GET | `/fuel-pump/issues` | query: `page`, `limit`, `vehicle_id`, `driver_id`, `tank_id`, `date_from`, `date_to`, `flagged_only` | Issues list | `FUEL_READ` or `FUEL_STOCK_VIEW` |
| GET | `/fuel-pump/issues/{issue_id}` | — | Issue detail | `FUEL_READ` |
| POST | `/fuel-pump/stock` | FuelStockTransactionCreate fields | Transaction detail | `FUEL_STOCK_EDIT` |
| GET | `/fuel-pump/stock` | query: `page`, `limit`, `tank_id` | Stock transactions | `FUEL_STOCK_VIEW` or `FUEL_READ` |
| GET | `/fuel-pump/alerts` | query: `page`, `limit`, `status` | Theft alerts list | `FUEL_REPORTS` or `FUEL_READ` or `ALERT_VIEW` |
| PUT | `/fuel-pump/alerts/{alert_id}` | FuelTheftAlertResolve fields | Alert detail | `FUEL_REPORTS` or `ALERT_MANAGE` |
| GET | `/fuel-pump/verification` | query: `days` | Fuel verification records | `FUEL_READ` or `FUEL_REPORTS` |

---

## 32. Driver Scoring — prefix `/driver-scoring`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/driver-scoring/leaderboard` | query: `month`, `year`, `branch_id`, `skip`, `limit` | Leaderboard list | `DRIVER_SCORE_READ` |
| GET | `/driver-scoring/fleet-distribution` | query: `month`, `year` | Score distribution | `DRIVER_SCORE_READ` |
| GET | `/driver-scoring/{driver_id}/score` | query: `month`, `year` | Monthly score | `DRIVER_SCORE_READ` |
| GET | `/driver-scoring/{driver_id}/score/breakdown` | query: `month`, `year` | Score breakdown | `DRIVER_SCORE_READ` |
| GET | `/driver-scoring/{driver_id}/score/trend` | query: `months` | Score trend (monthly) | `DRIVER_SCORE_READ` |
| GET | `/driver-scoring/{driver_id}/coaching-notes` | query: `skip`, `limit` | Coaching notes | `DRIVER_SCORE_READ` |
| POST | `/driver-scoring/{driver_id}/coaching-notes` | `note_text`, `category` | Note detail | `DRIVER_SCORE_READ` or `ALERT_MANAGE` |

---

## 33. Branches — prefix `/branches`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/branches` | query: `search`, `is_active` | Branches list | `require_branch_admin` |
| GET | `/branches/comparison` | query: `start_date`, `end_date` | Cross-branch P&L | `require_branch_admin` |
| GET | `/branches/{branch_id}` | — | Branch detail | `get_current_user` |
| POST | `/branches` | `name`, `code`, `address`, `city`, `state`, `pincode`, `phone`, `email`, `is_active`, `tenant_id` | Branch detail | `require_branch_admin` |
| PUT | `/branches/{branch_id}` | BranchUpdate fields | Branch detail | `require_branch_admin` |
| DELETE | `/branches/{branch_id}` | — | success | `require_branch_admin` |
| GET | `/branches/{branch_id}/resources` | — | Resource counts | `get_current_user` |
| GET | `/branches/{branch_id}/pnl` | query: `start_date`, `end_date` | P&L data | `get_current_user` |

---

## 34. Suppliers — prefix `/suppliers`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/suppliers` | query: `page`, `limit`, `search`, `status`, `supplier_type` | Suppliers list | `get_current_user` |
| GET | `/suppliers/{supplier_id}` | — | Supplier detail + vehicles | `get_current_user` |
| POST | `/suppliers` | SupplierCreate fields | `{id, code}` | `get_current_user` |
| PUT | `/suppliers/{supplier_id}` | SupplierUpdate fields | success | `get_current_user` |
| DELETE | `/suppliers/{supplier_id}` | — | success | `get_current_user` |
| GET | `/suppliers/{supplier_id}/vehicles` | — | Supplier vehicles list | `get_current_user` |
| POST | `/suppliers/{supplier_id}/vehicles` | SupplierVehicleCreate fields | `{id}` | `get_current_user` |
| DELETE | `/suppliers/vehicles/{sv_id}` | — | success | `get_current_user` |
| GET | `/suppliers/{supplier_id}/trips` | query: `page`, `limit` | Supplier trips | `get_current_user` |
| GET | `/suppliers/{supplier_id}/statement` | — | Account statement summary | `get_current_user` |

---

## 35. Supplier Portal — prefix `/portal/supplier`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/portal/supplier/login` | `email` | `{token, supplier_info}` | Public |
| GET | `/portal/supplier/trips` | query: `status`, `skip`, `limit` | Supplier's trips | `supplier` role |
| GET | `/portal/supplier/trips/{trip_id}` | — | Trip detail | `supplier` role |
| POST | `/portal/supplier/trips/{trip_id}/invoice` | `amount`, `invoice_number`, `remarks` | `{trip_id, invoice_submitted}` | `supplier` role |
| GET | `/portal/supplier/payments` | query: `skip`, `limit` | Payment/settlement history | `supplier` role |
| GET | `/portal/supplier/statement` | — | `{total_trips, total_earned, settled_trips, settled_amount, pending_amount}` | `supplier` role |

---

## 36. Customer Portal — prefix `/portal/customer`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/portal/customer/login` | `email` | `{token, customer_info}` | Public |
| GET | `/portal/customer/bookings` | query: `skip`, `limit` | Customer's bookings | `customer` role |
| POST | `/portal/customer/bookings` | `origin_city`, `destination_city`, `origin_address`, `destination_address`, `pickup_date`, `material_type`, `quantity`, `quantity_unit`, `vehicle_type_required`, `special_requirements` | `{id, job_number}` | `customer` role |
| GET | `/portal/customer/tracking/{job_id}` | — | `{tracking_token, tracking_url}` | `customer` role |
| GET | `/portal/customer/invoices` | query: `skip`, `limit` | Customer invoices | `customer` role |
| GET | `/portal/customer/payments` | query: `skip`, `limit` | Payment history | `customer` role |

---

## 37. Public Portal

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/portal/track/{token}` | — | Shipment tracking info | **Public** (no auth) |

---

## 38. Notifications — prefix `/notifications`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/notifications/push` | `device_token`, `title`, `body`, `data` | result | `ALERT_MANAGE` |
| POST | `/notifications/push/topic` | query: `topic`, `title`, `body` | result | `ALERT_MANAGE` |
| POST | `/notifications/sms` | `phone`, `message` | result | `ALERT_MANAGE` |
| POST | `/notifications/whatsapp` | `phone`, `message` | result | `ALERT_MANAGE` |
| POST | `/notifications/whatsapp/template` | `phone`, `template_id`, `params[]` | result | `ALERT_MANAGE` |

---

## 39. In-App Notifications — prefix `/my-notifications`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/my-notifications` | query: `unread_only`, `limit` | Notification list `{id, event_type, title, body, data, is_read, urgency, created_at}` | `get_current_user` |
| GET | `/my-notifications/unread-count` | — | `{count}` | `get_current_user` |
| PATCH | `/my-notifications/{notification_id}/read` | — | success | `get_current_user` |
| PATCH | `/my-notifications/read-all` | — | success | `get_current_user` |

---

## 40. GST — prefix `/gst`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/gst/verify/{gstin}` | — | Business details | `CLIENT_READ` |

---

## 41. eChallan — prefix `/echallan`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/echallan/vehicle/{reg_number}` | — | Vehicle challans list | `VEHICLE_READ` |
| GET | `/echallan/driver/{dl_number}` | — | Driver challans list | `DRIVER_READ` |
| GET | `/echallan/status/{challan_number}` | — | Challan payment status | `VEHICLE_READ` |

---

## 42. Sarathi (DL Verification) — prefix `/sarathi`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/sarathi/verify/{dl_number}` | query: `dob` (YYYY-MM-DD) | DL verification result | `DRIVER_READ` |
| GET | `/sarathi/details/{dl_number}` | — | Full DL details | `DRIVER_READ` |

---

## 43. VAHAN (Vehicle Compliance) — prefix `/vahan`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/vahan/rc/{reg_number}` | — | RC details | `VEHICLE_READ` |
| GET | `/vahan/insurance/{reg_number}` | — | Insurance status | `VEHICLE_READ` |
| GET | `/vahan/fitness/{reg_number}` | — | Fitness certificate status | `VEHICLE_READ` |
| GET | `/vahan/permit/{reg_number}` | — | Permit status | `VEHICLE_READ` |
| GET | `/vahan/puc/{reg_number}` | — | PUC status | `VEHICLE_READ` |
| GET | `/vahan/full-check/{reg_number}` | — | Full compliance: RC + Insurance + Fitness + Permit + PUC + Blacklist | `VEHICLE_READ` |

---

## 44. Maps — prefix `/maps`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| GET | `/maps/distance` | query: `origin`, `destination` | `{distance_km, duration, origin_address, destination_address}` | `get_current_user` |
| GET | `/maps/route` | query: `origin_lat`, `origin_lng`, `dest_lat`, `dest_lng` | Route distance + duration | `get_current_user` |
| GET | `/maps/geocode` | query: `address` | `{lat, lng, formatted_address}` | `get_current_user` |
| GET | `/maps/reverse-geocode` | query: `lat`, `lng` | `{formatted_address, city, state}` | `get_current_user` |

---

## 45. Sync (Offline Mobile) — prefix `/sync`

| Method | Full Path | Body / Query | Key Response Fields | Permission |
|--------|-----------|-------------|---------------------|------------|
| POST | `/sync/batch` | `device_id`, `actions[]{method, path, data, timestamp, client_action_id}` | `{results[], accepted, total}` | `SYNC_CREATE` |
| GET | `/sync/status` | — | Sync queue items for current user | `SYNC_CREATE` |

---

## 46. Aliases — no prefix (exact paths, mounted directly on api_router)

| Method | Full Path | Body / Query | Permission |
|--------|-----------|-------------|------------|
| GET | `/routes` | query: `page`, `limit`, `search` | `JOB_READ` |
| GET | `/ewb` | query: `page`, `limit`, `search`, `status` | `EWAY_READ` |
| GET | `/expenses` | query: `page`, `limit`, `trip_id` | `EXPENSE_READ` |
| POST | `/expenses` | TripExpenseCreate fields | `EXPENSE_CREATE` |
| PATCH | `/expenses/{expense_id}/status` | `status` (approved/rejected/paid) | `EXPENSE_APPROVE` |
| GET | `/fuel` | query: `page`, `limit` | `FUEL_READ` |
| GET | `/attendance` | query: `page`, `limit`, `date` | `get_current_user` |
| POST | `/attendance/check-in` | `photo_data_url`, `remarks`, `lat`, `lng` | `get_current_user` |
| GET | `/checklists` | query: `page`, `limit` | `TRIP_READ` |
| GET | `/invoices` | query: `page`, `limit`, `search`, `status`, `client_id` | `INVOICE_READ` |
| GET | `/banking` | query: `page`, `limit`, `account_id` | `PAYMENT_READ` |
| GET | `/ledger` | query: `page`, `limit` | `LEDGER_READ` |
| GET | `/service` | query: `page`, `limit` | `MAINTENANCE_READ` |
| POST | `/service` | dict (vehicle_id, service_type, notes, odometer…) | `MAINTENANCE_CREATE` |
| PUT | `/service/{item_id}` | dict | `MAINTENANCE_CREATE` |
| DELETE | `/service/{item_id}` | — | `MAINTENANCE_CREATE` |
| GET | `/notifications` | — | `ALERT_VIEW` |
| GET | `/notifications/unread-count` | — | `ALERT_VIEW` |

---

## 47. Compat (Compatibility shims) — no prefix (exact paths)

### Finance shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/finance/receivables` | `INVOICE_READ` |
| GET | `/finance/payables` | `PAYMENT_READ` |
| GET | `/finance/banking/accounts` | `PAYMENT_READ` |
| GET | `/finance/banking/next-entry-number` | `PAYMENT_READ` |
| GET | `/finance/banking/entries` | `PAYMENT_READ` |

### Fleet dashboard shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/fleet/dashboard` | `get_current_user` |
| GET | `/fleet/dashboard/kpis` | `get_current_user` |
| GET | `/fleet/dashboard/charts/fleet-utilization` | `get_current_user` |
| GET | `/fleet/dashboard/charts/fuel-consumption` | `get_current_user` |
| GET | `/fleet/dashboard/charts/maintenance-cost` | `get_current_user` |
| GET | `/fleet/dashboard/charts/trip-efficiency` | `get_current_user` |
| GET | `/fleet/dashboard/recent-alerts` | `get_current_user` |
| GET | `/fleet/dashboard/expiring-documents` | `get_current_user` |
| GET | `/fleet/dashboard/upcoming-maintenance` | `get_current_user` |
| GET | `/fleet/dashboard/active-trips` | `get_current_user` |
| GET | `/fleet/drivers` | `get_current_user` (paginated) |
| GET | `/fleet/tracking/live` | `get_current_user` |

### Fleet maintenance shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/fleet/maintenance/schedule` | `get_current_user` |
| GET | `/fleet/maintenance/work-orders` | `get_current_user` |
| GET | `/fleet/maintenance/parts-inventory` | `get_current_user` |
| GET | `/fleet/maintenance/battery` | `get_current_user` |

### Fleet fuel shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/fleet/fuel/records` | `get_current_user` |
| GET | `/fleet/fuel/summary` | `get_current_user` |

### Fleet reports shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/fleet/reports/fleet-utilization` | `get_current_user` |
| GET | `/fleet/reports/vehicle-profitability` | `get_current_user` |
| GET | `/fleet/reports/driver-performance` | `get_current_user` |
| GET | `/fleet/reports/maintenance-cost` | `get_current_user` |
| GET | `/fleet/reports/fuel-consumption` | `get_current_user` |
| GET | `/fleet/reports/trip-performance` | `get_current_user` |

### Lookup shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/jobs/lookup/routes` | `get_current_user` |
| GET | `/jobs/lookup/vehicle-types` | `get_current_user` |
| GET | `/jobs/lookup/states` | `get_current_user` |
| GET | `/jobs/next-job-number` | `get_current_user` |
| GET | `/lr/lookup/package-types` | `get_current_user` |
| GET | `/lr/lookup/quantity-units` | `get_current_user` |
| GET | `/lr/next-lr-number` | `get_current_user` |
| GET | `/trips/lookup/routes` | `get_current_user` |
| GET | `/trips/lookup/trip-types` | `get_current_user` |
| GET | `/trips/lookup/priorities` | `get_current_user` |
| GET | `/trips/lookup/payment-modes` | `get_current_user` |
| GET | `/trips/next-trip-number` | `get_current_user` |
| GET | `/documents/stats` | `get_current_user` |
| GET | `/documents/next-doc-number` | `get_current_user` |
| GET | `/documents/lookup/document-types` | `get_current_user` |
| GET | `/documents/lookup/entity-types` | `get_current_user` |
| GET | `/documents/lookup/compliance-categories` | `get_current_user` |
| GET | `/documents/lookup/reminder-options` | `get_current_user` |
| GET | `/documents/lookup/reviewers` | `get_current_user` |

### Accountant dashboard shims

| Method | Full Path | Permission |
|--------|-----------|------------|
| GET | `/accountant/dashboard/kpis` | `get_current_user` |
| GET | `/accountant/dashboard/revenue-trend` | `get_current_user` |
| GET | `/accountant/dashboard/expense-breakdown` | `get_current_user` |
| GET | `/accountant/dashboard/cash-flow` | `get_current_user` |
| GET | `/accountant/dashboard/recent-transactions` | `get_current_user` |
| GET | `/accountant/dashboard/pending-actions` | `get_current_user` |
| GET | `/accountant/payables` | `get_current_user` |
| PUT | `/accountant/expenses/{expense_id}/approve` | `EXPENSE_APPROVE` |
| PUT | `/accountant/expenses/{expense_id}/reject` | `EXPENSE_APPROVE` |
| GET | `/accountant/fuel-expenses` | `get_current_user` |
| GET | `/accountant/fuel-expenses/summary` | `get_current_user` |
| GET | `/accountant/banking/overview` | `get_current_user` |
| GET | `/accountant/banking/transactions` | `get_current_user` |
| GET | `/accountant/ledger/accounts` | `get_current_user` |
| GET | `/accountant/ledger/accounts/{account_id}/entries` | `get_current_user` |
| GET | `/accountant/reports/profit-loss` | `get_current_user` |
| GET | `/accountant/reports/expense-report` | `get_current_user` |
| GET | `/accountant/reports/revenue-report` | `get_current_user` |
| GET | `/accountant/reports/trip-profitability` | `get_current_user` |
| GET | `/accountant/reports/client-outstanding` | `get_current_user` |
| GET | `/accountant/reports/vendor-payables` | `get_current_user` |
| GET | `/accountant/reports/fuel-cost` | `get_current_user` |
| GET | `/accountant/reports/monthly-summary` | `get_current_user` |

---

## Summary Statistics

| Category | Route Count |
|----------|-------------|
| Auth | 6 |
| Users | 7 |
| Admin | 9 |
| Clients | 8 |
| Vehicles | 7 |
| Drivers | 25 |
| Jobs | 13 |
| Lorry Receipts | 9 |
| E-way Bills | 14 |
| Trips | 20 |
| Tracking | 10 |
| Market Trips | 10 |
| Finance (invoices + automation) | 43 |
| Payables | 5 |
| Receivable Payments | 3 |
| Banking | 12 |
| Accountant | 16 |
| Dashboard | 25 |
| PA Dashboard | 2 |
| Manager Dashboard | 3 |
| Fleet Manager | 4 |
| Reports | 16 |
| Intelligence | 15 |
| Compliance | 11 |
| Geofences | 7 |
| Documents | 6 |
| Service & Workshops | 10 |
| Tyre | 8 |
| TPMS | 8 |
| Fuel Prices | 2 |
| Fuel Pump | 14 |
| Driver Scoring | 7 |
| Branches | 8 |
| Suppliers | 10 |
| Supplier Portal | 6 |
| Customer Portal | 6 |
| Public Portal | 1 |
| Notifications (push/SMS/WA) | 5 |
| In-App Notifications | 4 |
| GST | 1 |
| eChallan | 3 |
| Sarathi | 2 |
| VAHAN | 6 |
| Maps | 4 |
| Sync | 2 |
| Aliases (18 routes) | 18 |
| Compat shims (71 routes) | 71 |
| **Total** | **~542** |
