# Kavya ERP — Complete Frontend Page → API Mapping

> **Base URL**: All endpoints prefixed with `/api/v1` (Axios instance in `services/api.ts`)
> **Auth**: JWT Bearer token via `Authorization` header; auto-refresh on 401
> **Generated**: Comprehensive mapping of every screen to its API calls

---

## 1. AUTH (Public)

### SCREEN: Login Page (route: `/login`)
- `POST /api/v1/auth/login` — Authenticate user with email + password
- `GET  /api/v1/auth/me` — Fetch current user profile after login

### SCREEN: Register Page (route: `/register`)
- `POST /api/v1/auth/register` — Create new user account

### SCREEN: Forgot Password Page (route: `/forgot-password`)
- `POST /api/v1/auth/forgot-password` — Request password reset email

### SCREEN: Reset Password Page (route: `/reset-password`)
- `POST /api/v1/auth/reset-password` — Reset password with token

---

## 2. DASHBOARD (role-based, route: `/` or `/dashboard`)

### SCREEN: Admin Dashboard Page
- `GET  /api/v1/dashboard/pa/kpis` — PA dashboard KPIs
- `GET  /api/v1/dashboard/pa/action-center` — Pending action items
- `GET  /api/v1/dashboard/pa/job-pipeline` — Job pipeline status
- `GET  /api/v1/dashboard/pa/recent-activity` — Recent activity feed
- `GET  /api/v1/dashboard/pa/banking-status` — Banking overview
- `GET  /api/v1/dashboard/pa/fleet-status` — Fleet overview
- `GET  /api/v1/dashboard/pa/compliance-alerts` — Compliance alert summary
- `GET  /api/v1/dashboard/pa/trip-workflow` — Trip workflow statistics
- `GET  /api/v1/dashboard/pa/system-alerts` — System-level alerts
- `GET  /api/v1/dashboard/pa/revenue-snapshot` — Revenue snapshot
- `GET  /api/v1/users` — List users (for team overview)

### SCREEN: Fleet Manager Dashboard Page
- `GET  /api/v1/dashboard/overview` — Dashboard overview stats
- `GET  /api/v1/dashboard/fleet-stats` — Fleet statistics
- `GET  /api/v1/dashboard/trip-stats` — Trip statistics
- `GET  /api/v1/dashboard/finance-stats` — Finance statistics
- `GET  /api/v1/dashboard/charts/revenue-trend` — Revenue trend chart
- `GET  /api/v1/dashboard/charts/expense-breakdown` — Expense breakdown chart
- `GET  /api/v1/dashboard/charts/fleet-utilization` — Fleet utilization chart
- `GET  /api/v1/dashboard/notifications` — Dashboard notifications
- `POST /api/v1/dashboard/notifications/:id/read` — Mark notification read

### SCREEN: Driver Dashboard Page (route: `/driver/dashboard`)
- `GET  /api/v1/drivers/me/trips` — Driver's own trips
- `GET  /api/v1/attendance` — Driver's attendance records
- `GET  /api/v1/expenses` — Driver's expenses
- `GET  /api/v1/users` — User info

---

## 3. CLIENTS

### SCREEN: Clients Page (route: `/clients`)
- `GET    /api/v1/clients` — List all clients (with search/pagination)
- `POST   /api/v1/clients` — Create new client
- `PUT    /api/v1/clients/:id` — Update client
- `DELETE /api/v1/clients/:id` — Delete client

### SCREEN: Client Detail Page (route: `/clients/:id`)
- `GET  /api/v1/clients/:id` — Get client details
- `GET  /api/v1/clients/:id/jobs` — Client's jobs
- `GET  /api/v1/clients/:id/invoices` — Client's invoices
- `GET  /api/v1/clients/:id/ledger` — Client's ledger entries
- `GET  /api/v1/clients/:id/outstanding` — Client's outstanding balance
- `GET  /api/v1/vehicles` — Vehicle list (for assignment)
- `GET  /api/v1/drivers` — Driver list (for assignment)
- `PUT  /api/v1/jobs/:id/assign` — Assign vehicle/driver to client job

---

## 4. VEHICLES

### SCREEN: Vehicles Page (route: `/vehicles`)
- `GET    /api/v1/vehicles` — List all vehicles (with search/filters)
- `GET    /api/v1/vehicles/summary` — Vehicle fleet summary
- `POST   /api/v1/vehicles` — Register new vehicle
- `PUT    /api/v1/vehicles/:id` — Update vehicle
- `DELETE /api/v1/vehicles/:id` — Delete vehicle

### SCREEN: Vehicle Detail Page (route: `/vehicles/:id`)
- `GET  /api/v1/vehicles/:id` — Get vehicle details
- `GET  /api/v1/vehicles/:id/overview` — Vehicle overview data
- `GET  /api/v1/vehicles/:id/trips` — Vehicle's trip history
- `GET  /api/v1/vehicles/:id/maintenance` — Maintenance records
- `GET  /api/v1/vehicles/:id/documents` — Vehicle documents
- `GET  /api/v1/vehicles/:id/health-score` — Vehicle health score
- `POST /api/v1/vehicles/:id/maintenance` — Add maintenance record

---

## 5. DRIVER MANAGEMENT

### SCREEN: Drivers Page (route: `/drivers`)
- `GET    /api/v1/drivers` — List all drivers (with search/filters)
- `POST   /api/v1/drivers` — Create new driver
- `PUT    /api/v1/drivers/:id` — Update driver
- `DELETE /api/v1/drivers/:id` — Delete driver
- `GET    /api/v1/users` — List users (for linking)

### SCREEN: Driver Availability Page (route: `/drivers/availability`)
- `GET  /api/v1/drivers/available` — List available drivers
- `GET  /api/v1/drivers/dashboard` — Drivers dashboard stats
- `POST /api/v1/drivers/:id/assign` — Assign driver
- `POST /api/v1/drivers/:id/unassign` — Unassign driver
- `POST /api/v1/drivers/:id/status` — Update driver status

### SCREEN: Driver Detail Page (route: `/drivers/:id`)
- `GET  /api/v1/drivers/:id` — Get driver details
- `GET  /api/v1/drivers/:id/trips` — Driver's trip history
- `GET  /api/v1/drivers/:id/attendance` — Driver's attendance
- `GET  /api/v1/drivers/:id/performance` — Performance metrics
- `GET  /api/v1/drivers/:id/behaviour` — Behaviour analytics
- `GET  /api/v1/drivers/:id/documents` — Driver documents
- `POST /api/v1/drivers/:id/attendance` — Record attendance

---

## 6. DRIVER APP (role: driver)

### SCREEN: Driver Trips Page (route: `/driver/trips`)
- `GET  /api/v1/drivers/me/trips` — Driver's assigned trips
- `PUT  /api/v1/drivers/me/trips/:id/complete` — Mark trip complete

### SCREEN: Driver Documents Page (route: `/driver/documents`)
- `GET  /api/v1/drivers/me/documents` — Driver's own documents

### SCREEN: Driver Expenses Page (route: `/driver/expenses`)
- `GET  /api/v1/expenses` — Driver's expense list

### SCREEN: Driver Attendance Page (route: `/driver/attendance`)
- `GET  /api/v1/attendance` — Driver's attendance records
- `POST /api/v1/attendance/check-in` — Check in/out

---

## 7. JOBS

### SCREEN: Jobs Page (route: `/jobs`)
- `GET    /api/v1/jobs` — List all jobs (with search/filters/pagination)
- `POST   /api/v1/jobs` — Create new job
- `PUT    /api/v1/jobs/:id` — Update job
- `DELETE /api/v1/jobs/:id` — Delete job
- `POST   /api/v1/jobs/:id/submit-for-approval` — Submit job for approval
- `POST   /api/v1/jobs/:id/approve` — Approve job
- `PUT    /api/v1/jobs/:id/assign` — Assign vehicle/driver to job
- `GET    /api/v1/vehicles` — Vehicles list (for assignment)
- `GET    /api/v1/drivers` — Drivers list (for assignment)

### SCREEN: Job Detail Page (route: `/jobs/:id`)
- `GET  /api/v1/jobs/:id` — Get job details
- `POST /api/v1/jobs/:id/submit-for-approval` — Submit for approval
- `POST /api/v1/jobs/:id/approve` — Approve job

### SCREEN: Create Job Page (route: `/jobs/create`)
- `POST /api/v1/jobs` — Create new job
- `PUT  /api/v1/jobs/:id` — Update existing job (edit mode)
- `PUT  /api/v1/jobs/:id/assign` — Assign vehicle/driver
- `GET  /api/v1/jobs/lookup/clients` — Client lookup
- `GET  /api/v1/jobs/lookup/routes` — Route lookup
- `GET  /api/v1/jobs/lookup/vehicle-types` — Vehicle type lookup
- `GET  /api/v1/jobs/lookup/states` — States lookup
- `GET  /api/v1/jobs/next-job-number` — Get next job number
- `GET  /api/v1/maps/distance` — Calculate route distance

---

## 8. TRIPS

### SCREEN: Trips Page (route: `/trips`)
- `GET    /api/v1/trips` — List all trips (with search/filters/pagination)
- `PUT    /api/v1/trips/:id` — Update trip
- `DELETE /api/v1/trips/:id` — Delete trip
- `PUT    /api/v1/trips/:id/start` — Start trip
- `PUT    /api/v1/trips/:id/close` — Close trip
- `PUT    /api/v1/trips/:id/reach` — Mark trip reached
- `POST   /api/v1/trips/:id/status` — Update trip status
- `GET    /api/v1/vehicles` — Vehicles list
- `GET    /api/v1/drivers` — Drivers list

### SCREEN: Trip Detail Page (route: `/trips/:id`)
- `GET  /api/v1/trips/:id` — Get trip details
- `GET  /api/v1/trips/:id/expenses` — Trip expenses
- `POST /api/v1/trips/:id/expenses` — Add trip expense
- `PUT  /api/v1/trips/:id/start` — Start trip
- `POST /api/v1/trips/:id/complete` — Complete trip
- `POST /api/v1/trips/:id/approve-payment` — Approve payment

### SCREEN: Create Trip Page (route: `/trips/create`)
- `POST /api/v1/trips` — Create new trip
- `GET  /api/v1/trips/next-trip-number` — Get next trip number
- `GET  /api/v1/trips/lookup/jobs` — Job lookup
- `GET  /api/v1/trips/lookup/vehicles` — Vehicle lookup
- `GET  /api/v1/trips/lookup/drivers` — Driver lookup
- `GET  /api/v1/trips/lookup/lrs` — LR lookup
- `GET  /api/v1/trips/lookup/routes` — Route lookup
- `GET  /api/v1/trips/lookup/trip-types` — Trip type lookup
- `GET  /api/v1/trips/lookup/priorities` — Priority lookup
- `GET  /api/v1/trips/lookup/payment-modes` — Payment mode lookup
- `GET  /api/v1/trips/lookup/expense-categories` — Expense category lookup
- `GET  /api/v1/trips/lookup/document-types` — Document type lookup

### SCREEN: Route Calculator Page (route: `/trips/route-calculator`)
- `GET /api/v1/maps/route` — Calculate route between points
- `GET /api/v1/maps/geocode` — Geocode address to coordinates

---

## 9. LORRY RECEIPTS (LR)

### SCREEN: LR List Page (route: `/lr`)
- `GET    /api/v1/lr` — List all LRs (with search/filters/pagination)
- `POST   /api/v1/lr` — Create new LR
- `PUT    /api/v1/lr/:id` — Update LR
- `DELETE /api/v1/lr/:id` — Delete LR
- `POST   /api/v1/lr/:id/cancel` — Cancel LR

### SCREEN: LR Detail Page (route: `/lr/:id`)
- `GET  /api/v1/lr/:id` — Get LR details
- `GET  /api/v1/lr/:id/print` — Get LR print view
- `GET  /api/v1/lr/:id/status-history` — LR status history
- `POST /api/v1/lr/:id/pod` — Upload Proof of Delivery
- `POST /api/v1/lr/:id/pod/verify` — Verify POD

### SCREEN: Create LR Page (route: `/lr/create`)
- `POST /api/v1/lr` — Create new LR
- `POST /api/v1/lr/:id/generate` — Generate LR document
- `GET  /api/v1/lr/next-lr-number` — Get next LR number
- `GET  /api/v1/lr/lookup/package-types` — Package type lookup
- `GET  /api/v1/lr/lookup/quantity-units` — Quantity unit lookup
- `GET  /api/v1/users` — User list (consignor/consignee)

---

## 10. E-WAY BILLS

### SCREEN: E-Way Bill List Page (route: `/eway-bills`)
- `GET    /api/v1/eway-bills` — List all e-way bills (with filters)
- `GET    /api/v1/eway-bills/active` — Active e-way bills
- `GET    /api/v1/eway-bills/expiring` — Expiring e-way bills
- `POST   /api/v1/eway-bills` — Create new e-way bill
- `DELETE /api/v1/eway-bills/:id` — Delete e-way bill

### SCREEN: E-Way Bill Detail Page (route: `/eway-bills/:id`)
- `GET  /api/v1/eway-bills/:id` — Get e-way bill details
- `GET  /api/v1/eway-bills/:id/print` — Print e-way bill
- `GET  /api/v1/eway-bills/:id/status-history` — Status history
- `POST /api/v1/eway-bills/:id/generate` — Generate e-way bill on portal
- `POST /api/v1/eway-bills/:id/cancel` — Cancel e-way bill
- `POST /api/v1/eway-bills/:id/extend` — Extend e-way bill validity

### SCREEN: Create E-Way Bill Page (route: `/eway-bills/create`)
- `POST /api/v1/eway-bills` — Create new e-way bill
- `GET  /api/v1/eway-bills/next-eway-number` — Get next e-way number
- `GET  /api/v1/eway-bills/validity-calculator` — Calculate validity
- `GET  /api/v1/eway-bills/lookup/jobs` — Job lookup
- `GET  /api/v1/eway-bills/lookup/lrs` — LR lookup
- `GET  /api/v1/eway-bills/lookup/states` — States lookup
- `GET  /api/v1/eway-bills/lookup/hsn-codes` — HSN code lookup
- `GET  /api/v1/eway-bills/lookup/uqc-codes` — UQC code lookup
- `GET  /api/v1/eway-bills/lookup/document-types` — Document type lookup
- `GET  /api/v1/eway-bills/lookup/transaction-types` — Transaction type lookup
- `GET  /api/v1/eway-bills/lookup/gst-rates` — GST rate lookup
- `GET  /api/v1/eway-bills/lookup/vehicles` — Vehicle lookup

---

## 11. FINANCE

### SCREEN: Invoices Page (route: `/finance/invoices`)
- `GET    /api/v1/finance/invoices` — List invoices (with status/search filters)
- `POST   /api/v1/finance/invoices` — Create invoice
- `PUT    /api/v1/finance/invoices/:id` — Update invoice
- `DELETE /api/v1/finance/invoices/:id` — Delete invoice
- `GET    /api/v1/finance/invoices/:id/pdf` — Download invoice PDF
- `POST   /api/v1/finance/invoices/:id/send` — Email invoice to client
- `POST   /api/v1/finance/invoices/:id/mark-paid` — Mark invoice as paid
- `POST   /api/v1/finance/invoices/generate-from-trip/:tripId` — Auto-generate invoice from trip

### SCREEN: Payments Page (route: `/finance/payments`)
- `GET  /api/v1/finance/payments` — List payments (with filters)
- `POST /api/v1/finance/payments` — Record new payment
- `POST /api/v1/finance/payment-links` — Create payment link
- `GET  /api/v1/finance/payment-links` — List payment links
- `POST /api/v1/finance/payment-links/:id/resend` — Resend payment link

### SCREEN: Ledger Page (route: `/finance/ledger`)
- `GET /api/v1/finance/ledger` — Get ledger entries

### SCREEN: Receivables Page (route: `/finance/receivables`)
- `GET /api/v1/finance/receivables` — List receivables

### SCREEN: Payables Page (route: `/finance/payables`)
- `GET  /api/v1/finance/payables` — List payables
- `POST /api/v1/finance/supplier-payables` — Create supplier payable
- `GET  /api/v1/finance/supplier-payables` — List supplier payables
- `POST /api/v1/finance/supplier-payables/:id/pay` — Pay supplier

### SCREEN: GST Page (route: `/finance/gst`)
- `GET /api/v1/finance/gst/summary` — GST summary
- `GET /api/v1/finance/gst/gstr1` — GSTR-1 report
- `GET /api/v1/finance/gst/gstr3b` — GSTR-3B report

### SCREEN: Profit & Loss Page (route: `/finance/profit-loss`)
- `GET /api/v1/finance/profit-loss` — P&L statement

### SCREEN: Reconciliation Page (route: `/finance/reconciliation`)
- `GET  /api/v1/finance/banking/entries` — Banking entries
- `POST /api/v1/finance/bank-statements/import` — Import bank statement
- `GET  /api/v1/finance/bank-statements/:id/summary` — Statement summary
- `GET  /api/v1/finance/bank-statements/:id/lines` — Statement line items
- `POST /api/v1/finance/bank-statements/lines/:id/match` — Match line item
- `POST /api/v1/finance/bank-statements/lines/:id/ignore` — Ignore line item
- `POST /api/v1/finance/bank-statements/:id/reconcile` — Reconcile statement

### SCREEN: Settlements Page (route: `/finance/settlements`)
- `GET  /api/v1/finance/settlements` — List settlements
- `POST /api/v1/finance/settlements` — Create settlement
- `POST /api/v1/finance/settlements/:id/approve` — Approve settlement
- `POST /api/v1/finance/settlements/:id/pay` — Pay settlement

### SCREEN: Finance Alerts Page (route: `/finance/alerts`)
- `GET  /api/v1/finance/alerts` — List finance alerts
- `POST /api/v1/finance/alerts` — Create alert rule
- `POST /api/v1/finance/alerts/:id/read` — Mark alert as read
- `POST /api/v1/finance/alerts/:id/resolve` — Resolve alert
- `GET  /api/v1/finance/fastag` — FASTag balance data

### SCREEN: Finance Automation Page (route: `/finance/automation`)
- `GET /api/v1/finance/automation/duplicate-check` — Check for duplicate entries
- `GET /api/v1/finance/automation/freight-leakage/:id` — Detect freight leakage
- `GET /api/v1/finance/automation/partial-payments` — Flag partial payments
- `GET /api/v1/finance/reports/daily-digest` — Daily digest report
- `GET /api/v1/finance/reports/weekly-pl` — Weekly P&L report
- `GET /api/v1/finance/reports/monthly-close` — Monthly close report
- `GET /api/v1/finance/reports/gstr1` — GSTR-1 report

---

## 12. BANKING

### SCREEN: Banking Page (route: `/banking`)
- `GET    /api/v1/banking/entries` — List banking entries
- `POST   /api/v1/banking/entries` — Create banking entry
- `PUT    /api/v1/banking/entries/:id` — Update entry
- `DELETE /api/v1/banking/entries/:id` — Delete entry
- `GET    /api/v1/banking/balance` — Current balance
- `GET    /api/v1/banking/balance/history` — Balance history
- `GET    /api/v1/finance/bank-accounts` — List bank accounts
- `POST   /api/v1/banking/reconciliation/import` — Import for reconciliation
- `POST   /api/v1/banking/reconciliation/match` — Match transactions
- `GET    /api/v1/banking/reconciliation` — Reconciliation status

---

## 13. FLEET MANAGEMENT

### SCREEN: Fleet Dashboard Page (route: `/fleet`)
- `GET /api/v1/fleet/dashboard/kpis` — Fleet KPI metrics
- `GET /api/v1/fleet/dashboard/charts/fleet-utilization` — Fleet utilization chart
- `GET /api/v1/fleet/dashboard/charts/fuel-consumption` — Fuel consumption chart
- `GET /api/v1/fleet/dashboard/charts/maintenance-cost` — Maintenance cost chart
- `GET /api/v1/fleet/dashboard/charts/trip-efficiency` — Trip efficiency chart
- `GET /api/v1/fleet/dashboard/recent-alerts` — Recent fleet alerts
- `GET /api/v1/fleet/dashboard/expiring-documents` — Expiring documents
- `GET /api/v1/fleet/dashboard/upcoming-maintenance` — Upcoming maintenance
- `GET /api/v1/fleet/dashboard/active-trips` — Currently active trips

### SCREEN: Fleet Vehicle Profile Page (route: `/fleet/vehicles/:id`)
- `GET /api/v1/fleet/vehicles/:id/profile` — Vehicle full profile

### SCREEN: Fleet Drivers Page (route: `/fleet/drivers`)
- `GET /api/v1/fleet/drivers` — List fleet drivers

### SCREEN: Fleet Driver Profile Page (route: `/fleet/drivers/:id`)
- `GET /api/v1/fleet/drivers/:id/profile` — Driver full profile

### SCREEN: Fleet Live Tracking Page (route: `/fleet/tracking`)
- `GET /api/v1/fleet/tracking/live` — Live fleet positions

### SCREEN: Maintenance Schedule Page (route: `/fleet/maintenance`)
- `GET /api/v1/fleet/maintenance/schedule` — Maintenance schedule

### SCREEN: Work Orders Page (route: `/fleet/maintenance/work-orders`)
- `GET /api/v1/fleet/maintenance/work-orders` — List work orders

### SCREEN: Parts Inventory Page (route: `/fleet/maintenance/parts`)
- `GET /api/v1/fleet/maintenance/parts-inventory` — Parts inventory

### SCREEN: Battery Monitoring Page (route: `/fleet/maintenance/battery`)
- `GET /api/v1/fleet/maintenance/battery` — Battery status data

### SCREEN: Tyre Page (route: `/fleet/tyres`)
- `GET    /api/v1/tyre` — List tyres
- `POST   /api/v1/tyre` — Add tyre
- `PUT    /api/v1/tyre/:id` — Update tyre
- `DELETE /api/v1/tyre/:id` — Delete tyre
- `POST   /api/v1/tyre/:id/event` — Log tyre event (rotation, puncture, etc.)
- `GET    /api/v1/vehicles` — Vehicle list (for tyre assignment)

### SCREEN: Fuel Page (route: `/fleet/fuel`)
- `GET    /api/v1/fuel` — List fuel records
- `POST   /api/v1/fuel` — Add fuel record
- `PUT    /api/v1/fuel/:id` — Update fuel record
- `DELETE /api/v1/fuel/:id` — Delete fuel record
- `GET    /api/v1/fleet/fuel/summary` — Fuel summary stats
- `GET    /api/v1/vehicles` — Vehicle list
- `GET    /api/v1/trips` — Trip list (for linking fuel to trip)

### SCREEN: Compliance Dashboard Page (route: `/fleet/compliance`)
- `GET /api/v1/compliance/alerts` — Compliance alerts
- `GET /api/v1/compliance/alerts/summary` — Alert summary
- `PUT /api/v1/compliance/alerts/:id/resolve` — Resolve compliance alert
- `GET /api/v1/compliance/audit-notes` — Audit notes
- `POST /api/v1/compliance/audit-notes` — Create audit note
- `PUT /api/v1/compliance/audit-notes/:id/resolve` — Resolve audit note

### SCREEN: Safety Events Page (route: `/fleet/compliance/events`)
- `GET  /api/v1/compliance/events` — List safety events
- `POST /api/v1/compliance/events` — Report safety event
- `GET  /api/v1/compliance/events/driver/:id/summary` — Driver safety summary

### SCREEN: Driver Scoring Page (route: `/fleet/driver-scoring`)
- `GET /api/v1/driver-scoring/leaderboard` — Driver leaderboard
- `GET /api/v1/driver-scoring/fleet-distribution` — Score distribution

### SCREEN: Driver Scoring Detail Page (route: `/fleet/driver-scoring/:id`)
- `GET  /api/v1/driver-scoring/:id/score` — Driver's overall score
- `GET  /api/v1/driver-scoring/:id/score/breakdown` — Score breakdown
- `GET  /api/v1/driver-scoring/:id/score/trend` — Score trend over time
- `GET  /api/v1/driver-scoring/:id/coaching-notes` — Coaching notes
- `POST /api/v1/driver-scoring/:id/coaching-notes` — Add coaching note

### SCREEN: Geofences Page (route: `/fleet/geofences`)
- `GET    /api/v1/geofences` — List geofences
- `POST   /api/v1/geofences` — Create geofence
- `PUT    /api/v1/geofences/:id` — Update geofence
- `DELETE /api/v1/geofences/:id` — Delete geofence
- `POST   /api/v1/geofences/check` — Check point-in-geofence

### SCREEN: TPMS Dashboard Page (route: `/fleet/tpms`)
- `GET /api/v1/tpms/fleet` — Fleet tyre pressure overview
- `GET /api/v1/tpms/alerts` — TPMS alerts
- `GET /api/v1/tpms/predict-fleet` — Fleet tyre predictions

### SCREEN: TPMS Vehicle Detail Page (route: `/fleet/tpms/:id`)
- `GET  /api/v1/tpms/vehicle/:id` — Vehicle TPMS data
- `GET  /api/v1/tpms/predict/:vehicleId` — Tyre predictions for vehicle
- `POST /api/v1/tpms/reading` — Submit TPMS reading

### SCREEN: Fleet Reports Page (route: `/fleet/reports`)
- `GET /api/v1/fleet/reports/fleet-utilization` — Fleet utilization report
- `GET /api/v1/fleet/reports/vehicle-profitability` — Vehicle profitability report
- `GET /api/v1/fleet/reports/driver-performance` — Driver performance report
- `GET /api/v1/fleet/reports/maintenance-cost` — Maintenance cost report
- `GET /api/v1/fleet/reports/fuel-consumption` — Fuel consumption report
- `GET /api/v1/fleet/reports/trip-performance` — Trip performance report

---

## 14. TRACKING

### SCREEN: Live Tracking Page (route: `/tracking`)
- `GET /api/v1/tracking/live` — All vehicle live positions
- `GET /api/v1/tracking/alerts` — Tracking alerts
- `POST /api/v1/tracking/alerts/:id/acknowledge` — Acknowledge alert

### SCREEN: GPS Live Map Page (route: `/tracking/gps`)
- `GET /api/v1/tracking/gps/positions` — GPS positions of all vehicles

### SCREEN: Trip Replay Page (route: `/tracking/replay`)
- `GET /api/v1/tracking/trip/:id/trail` — Trip trail/replay data
- `GET /api/v1/tracking/gps/path/:vehicleId` — GPS path for vehicle

---

## 15. DOCUMENTS

### SCREEN: Documents Page (route: `/documents`)
- `GET    /api/v1/documents` — List all documents (with filters)
- `POST   /api/v1/documents` — Create document record
- `PUT    /api/v1/documents/:id` — Update document
- `DELETE /api/v1/documents/:id` — Delete document
- `POST   /api/v1/documents/:id/submit` — Submit for approval
- `POST   /api/v1/documents/:id/approve` — Approve document
- `POST   /api/v1/documents/:id/reject` — Reject document
- `GET    /api/v1/documents/stats` — Document statistics
- `GET    /api/v1/documents/next-doc-number` — Next document number
- `GET    /api/v1/documents/lookup/entities` — Entity lookup
- `GET    /api/v1/documents/lookup/compliance-categories` — Compliance category lookup
- `GET    /api/v1/documents/lookup/reminder-options` — Reminder option lookup
- `GET    /api/v1/documents/lookup/approval-statuses` — Approval status lookup
- `GET    /api/v1/documents/lookup/reviewers` — Reviewer lookup

### SCREEN: Document Requirements Page (route: `/documents/requirements`)
- `GET /api/v1/documents/requirements` — Document compliance requirements

### SCREEN: Document Upload Page (route: `/documents/upload`)
- `POST /api/v1/documents/upload` — Upload document file
- `POST /api/v1/documents/extract` — Extract data from document (OCR)

---

## 16. REPORTS

### SCREEN: Reports Page (route: `/reports`)
- `GET /api/v1/reports/dashboard` — Reports dashboard summary
- `GET /api/v1/reports/trip-summary` — Trip summary report
- `GET /api/v1/reports/vehicle-performance` — Vehicle performance report
- `GET /api/v1/reports/driver-performance` — Driver performance report
- `GET /api/v1/reports/fuel-analysis` — Fuel analysis report
- `GET /api/v1/reports/revenue-analysis` — Revenue analysis report
- `GET /api/v1/reports/expense-analysis` — Expense analysis report
- `GET /api/v1/reports/route-analysis` — Route analysis report
- `GET /api/v1/reports/client-outstanding` — Client outstanding report
- `GET /api/v1/reports/export/:type` — Export report (CSV/PDF)

---

## 17. MASTERS

### SCREEN: Routes Page (route: `/masters/routes`)
- `GET    /api/v1/routes` — List routes
- `POST   /api/v1/finance/routes` — Create route (via direct API)
- `PUT    /api/v1/finance/routes/:id` — Update route (via direct API)
- `DELETE /api/v1/finance/routes/:id` — Delete route (via direct API)

---

## 18. SETTINGS

### SCREEN: Settings Page (route: `/settings`)
- `POST /api/v1/auth/change-password` — Change password

### SCREEN: Profile Page (route: `/settings/profile`)
- `GET /api/v1/auth/me` — Get current user profile
- `PUT /api/v1/auth/me/photo` — Update profile photo

### SCREEN: Notification Center Page (route: `/settings/notifications`)
- `POST /api/v1/notifications/sms` — Send SMS notification
- `POST /api/v1/notifications/whatsapp` — Send WhatsApp notification
- `POST /api/v1/notifications/push` — Send push notification

---

## 19. ADMIN

### SCREEN: Employees Page (route: `/admin/employees`)
- `GET    /api/v1/users` — List all users/employees
- `POST   /api/v1/users` — Create new employee
- `PUT    /api/v1/users/:id` — Update employee
- `DELETE /api/v1/users/:id` — Delete employee

### SCREEN: Attendance Page (route: `/admin/attendance`)
- `GET /api/v1/attendance` — List attendance records (with date filter)
- `GET /api/v1/users` — User list (for mapping)

### SCREEN: Branches Page (route: `/admin/branches`)
- `GET  /api/v1/branches` — List branches (with search)
- `POST /api/v1/branches` — Create branch
- `PUT  /api/v1/branches/:id` — Update branch
- `DELETE /api/v1/branches/:id` — Delete branch
- `GET  /api/v1/branches/comparison` — Branch comparison data

### SCREEN: Branch Detail Page (route: `/admin/branches/:id`)
- `GET /api/v1/branches/:id` — Branch details
- `GET /api/v1/branches/:id/resources` — Branch resources (vehicles, drivers, staff)
- `GET /api/v1/branches/:id/pnl` — Branch P&L (with optional date range)

### SCREEN: Connectivity Page (route: `/admin/connectivity`)
- *(No API calls — static connectivity/health check UI)*

---

## 20. ACCOUNTANT

### SCREEN: Accountant Dashboard Page (route: `/accountant`)
- `GET /api/v1/accountant/dashboard/kpis` — KPI summary
- `GET /api/v1/reports/dashboard` — Reports dashboard data
- `GET /api/v1/accountant/dashboard/revenue-trend` — Revenue trend chart
- `GET /api/v1/accountant/dashboard/expense-breakdown` — Expense breakdown chart
- `GET /api/v1/accountant/dashboard/cash-flow` — Cash flow chart
- `GET /api/v1/accountant/dashboard/recent-transactions` — Recent transactions
- `GET /api/v1/accountant/dashboard/pending-actions` — Pending actions queue

### SCREEN: Accountant Invoices Page (route: `/accountant/invoices`)
- `GET  /api/v1/finance/invoices` — List invoices (with status/search filters)
- `GET  /api/v1/trips` — Trip list (for invoice generation)
- `POST /api/v1/finance/invoices/:id/send` — Send invoice
- `POST /api/v1/finance/invoices/:id/mark-paid` — Mark invoice paid
- `POST /api/v1/finance/invoices/generate-from-trip/:tripId` — Generate invoice from trip

### SCREEN: Accountant Receivables Page (route: `/accountant/receivables`)
- `GET  /api/v1/accountant/receivables` — Receivables list
- `GET  /api/v1/accountant/invoices` — Invoices list
- `POST /api/v1/accountant/receivables/:id/send-reminder` — Send payment reminder

### SCREEN: Accountant Payables Page (route: `/accountant/payables`)
- `GET  /api/v1/accountant/payables` — Payables list
- `POST /api/v1/accountant/payables/:id/pay` — Pay vendor

### SCREEN: Accountant Expenses Page (route: `/accountant/expenses`)
- `GET    /api/v1/expenses` — List expenses (with category filter)
- `GET    /api/v1/trips` — Trip list (for linking)
- `PUT    /api/v1/accountant/expenses/:id/approve` — Approve expense
- `PUT    /api/v1/accountant/expenses/:id/reject` — Reject expense
- `POST   /api/v1/accountant/expenses` — Create expense
- `PUT    /api/v1/expenses/:id` — Update expense (fallback: `/accountant/expenses/:id`)
- `DELETE /api/v1/expenses/:id` — Delete expense (fallback: `/accountant/expenses/:id`)

### SCREEN: Accountant Fuel Expenses Page (route: `/accountant/fuel-expenses`)
- `GET /api/v1/accountant/fuel-expenses` — List fuel expenses
- `GET /api/v1/accountant/fuel-expenses/summary` — Fuel expense summary

### SCREEN: Accountant Banking Page (route: `/accountant/banking`)
- `GET    /api/v1/banking` — List banking transactions (with account filter)
- `GET    /api/v1/finance/bank-accounts` — Bank account list
- `GET    /api/v1/jobs` — Job list
- `GET    /api/v1/trips` — Trip list
- `POST   /api/v1/finance/bank-transactions` — Create bank transaction
- `PUT    /api/v1/banking/:id/approve` — Approve transaction (fallback: `/accountant/banking/transactions/:id/approve`)
- `DELETE /api/v1/banking/:id` — Delete transaction (fallback: `/accountant/banking/transactions/:id`)
- `PUT    /api/v1/banking/:id` — Edit transaction (fallback: `/accountant/banking/transactions/:id`)

### SCREEN: Accountant Ledger Page (route: `/accountant/ledger`)
- `GET /api/v1/accountant/ledger` — Ledger entries

### SCREEN: Accountant Reports Page (route: `/accountant/reports`)
- `GET /api/v1/accountant/reports/profit-loss` — Profit & Loss report
- `GET /api/v1/accountant/reports/expense-report` — Expense report
- `GET /api/v1/accountant/reports/revenue-report` — Revenue report
- `GET /api/v1/accountant/reports/trip-profitability` — Trip profitability report
- `GET /api/v1/accountant/reports/client-outstanding` — Client outstanding report
- `GET /api/v1/accountant/reports/vendor-payables` — Vendor payables report
- `GET /api/v1/accountant/reports/fuel-cost` — Fuel cost report
- `GET /api/v1/accountant/reports/monthly-summary` — Monthly summary report

### SCREEN: Accountant Driver Payments Page (route: `/accountant/driver-payments`)
- `GET  /api/v1/accountant/driver-payments` — List driver payments (pending/completed)
- `POST /api/v1/accountant/driver-payments/:id/mark-paid` — Mark driver payment as paid

---

## 21. SUPPLIERS

### SCREEN: Suppliers Page (route: `/suppliers`)
- `GET    /api/v1/suppliers` — List suppliers (with filters)
- `POST   /api/v1/suppliers` — Create supplier
- `PUT    /api/v1/suppliers/:id` — Update supplier
- `DELETE /api/v1/suppliers/:id` — Delete supplier

### SCREEN: Supplier Detail Page (route: `/suppliers/:id`)
- `GET    /api/v1/suppliers/:id` — Supplier details
- `GET    /api/v1/suppliers/:id/trips` — Supplier's trips
- `GET    /api/v1/suppliers/:id/statement` — Supplier's financial statement
- `POST   /api/v1/suppliers/:id/vehicles` — Add vehicle to supplier
- `DELETE /api/v1/suppliers/vehicles/:svId` — Remove vehicle from supplier

---

## 22. MARKET TRIPS

### SCREEN: Market Trips Page (route: `/market-trips`)
- `GET  /api/v1/market-trips` — List market trips (with search/status filter)
- `GET  /api/v1/suppliers` — Supplier list
- `POST /api/v1/market-trips` — Create market trip
- `PUT  /api/v1/market-trips/:id/cancel` — Cancel market trip

### SCREEN: Market Trip Detail Page (route: `/market-trips/:id`)
- `GET  /api/v1/market-trips/:id` — Market trip details
- `GET  /api/v1/market-trips/:id/pnl` — Trip P&L
- `PUT  /api/v1/market-trips/:id/assign` — Assign supplier/vehicle
- `PUT  /api/v1/market-trips/:id/start` — Start transit
- `PUT  /api/v1/market-trips/:id/deliver` — Mark delivered
- `POST /api/v1/market-trips/:id/settle` — Settle trip
- `PUT  /api/v1/market-trips/:id/cancel` — Cancel trip

---

## 23. PUMP (Fuel Pump Operator)

### SCREEN: Pump Dashboard Page (route: `/pump`)
- `GET /api/v1/fuel-pump/dashboard` — Pump dashboard summary

### SCREEN: Pump Issue Fuel Page (route: `/pump/issue`)
- `GET  /api/v1/fuel-pump/tanks` — Tank list
- `GET  /api/v1/vehicles` — Vehicle list
- `GET  /api/v1/drivers` — Driver list
- `POST /api/v1/fuel-pump/issues` — Issue fuel

### SCREEN: Pump Fuel Log Page (route: `/pump/log`)
- `GET /api/v1/fuel-pump/issues` — Fuel issue log (with pagination, flagged filter)

### SCREEN: Pump Stock Page (route: `/pump/stock`)
- `GET  /api/v1/fuel-pump/tanks` — Tank list
- `GET  /api/v1/fuel-pump/stock` — Stock transactions (with pagination)
- `POST /api/v1/fuel-pump/stock` — Add stock receipt
- `POST /api/v1/fuel-pump/tanks` — Create new tank

### SCREEN: Pump Alerts Page (route: `/pump/alerts`)
- `GET /api/v1/fuel-pump/alerts` — Alert list (with status filter)
- `PUT /api/v1/fuel-pump/alerts/:id` — Resolve/update alert

### SCREEN: Pump Reports Page (route: `/pump/reports`)
- `GET /api/v1/fuel-pump/dashboard` — Dashboard data (for report)
- `GET /api/v1/fuel-pump/issues` — Issue history (date range)
- `GET /api/v1/fuel-pump/tanks` — Tank data

### SCREEN: Fuel Verification Page (route: `/pump/verification`)
- `GET /api/v1/fuel-pump/verification` — Verification data (by days)

---

## 24. CUSTOMER PORTAL (Public)

### SCREEN: Customer Login Page (route: `/portal/customer/login`)
- `POST /api/v1/portal/customer/login` — Customer login via email

### SCREEN: Customer Dashboard Page (route: `/portal/customer`)
- `GET  /api/v1/portal/customer/bookings` — Customer's bookings
- `GET  /api/v1/portal/customer/invoices` — Customer's invoices
- `GET  /api/v1/portal/customer/payments` — Customer's payments
- `POST /api/v1/portal/customer/bookings` — Create new booking
- `GET  /api/v1/portal/customer/tracking/:jobId` — Get tracking link for job
- `GET  /api/v1/portal/customer/pay/:invoiceId` — Get payment link for invoice

### SCREEN: Customer Tracking Page (route: `/portal/customer/track/:token`)
- `GET /api/v1/portal/track/:token` — Public tracking by token

---

## 25. SUPPLIER PORTAL (Public)

### SCREEN: Supplier Login Page (route: `/portal/supplier/login`)
- `POST /api/v1/portal/supplier/login` — Supplier login via email

### SCREEN: Supplier Dashboard Page (route: `/portal/supplier`)
- `GET  /api/v1/portal/supplier/trips` — Supplier's trips
- `GET  /api/v1/portal/supplier/payments` — Supplier's payments
- `GET  /api/v1/portal/supplier/statement` — Supplier's statement
- `POST /api/v1/portal/supplier/trips/:id/invoice` — Submit invoice for trip

---

## 26. REAL-TIME (WebSocket)

### WebSocket Connection
- `ws://host/ws?token=JWT` — WebSocket connection for real-time updates

**Events received:**
- `alert` — Real-time alert notifications
- `tracking_update` — Vehicle position updates
- `trip_update` — Trip status changes
- `dashboard_refresh` — Dashboard data invalidation

**React Query invalidation triggers:**
- Trip updates → invalidate `['trips']`, `['trip-detail']`
- Tracking updates → invalidate `['tracking']`
- Alert events → invalidate `['alerts']`, `['notifications']`

---

## 27. EXTERNAL INTEGRATIONS (used across pages)

### Vahan (Vehicle RC) — used in Fleet/Vehicle pages
- `GET /api/v1/vahan/rc/:regNumber` — RC details
- `GET /api/v1/vahan/insurance/:regNumber` — Insurance details
- `GET /api/v1/vahan/fitness/:regNumber` — Fitness certificate
- `GET /api/v1/vahan/permit/:regNumber` — Permit details
- `GET /api/v1/vahan/puc/:regNumber` — PUC details
- `GET /api/v1/vahan/full-check/:regNumber` — Full vehicle check

### Sarathi (Driver DL) — used in Driver pages
- `GET /api/v1/sarathi/verify/:dlNumber` — Verify DL
- `GET /api/v1/sarathi/details/:dlNumber` — DL details

### E-Challan — used in Compliance pages
- `GET /api/v1/echallan/vehicle/:regNumber` — Vehicle challans
- `GET /api/v1/echallan/driver/:dlNumber` — Driver challans
- `GET /api/v1/echallan/status/:challanNumber` — Challan status

### GST Verification — used in E-Way Bill pages
- `GET /api/v1/gst/verify/:gstin` — Verify GSTIN

### Maps — used in Jobs/Trips/Tracking pages
- `GET /api/v1/maps/route` — Calculate route
- `GET /api/v1/maps/geocode` — Address to coordinates
- `GET /api/v1/maps/reverse-geocode` — Coordinates to address
- `GET /api/v1/maps/distance` — Distance calculation

### Fuel Prices — used in Fleet/Fuel pages
- `GET /api/v1/fuel-prices` — Current fuel prices
- `GET /api/v1/fuel-prices/bulk` — Bulk fuel price data

### Payment Gateway — used in Finance pages
- `POST /api/v1/finance/payment-gateway/links` — Create payment gateway link

---

## SUMMARY STATISTICS

| Section | Pages | Unique API Endpoints |
|---------|-------|---------------------|
| Auth | 4 | 8 |
| Dashboard | 3 | ~25 |
| Clients | 2 | 10 |
| Vehicles | 2 | 12 |
| Driver Management | 3 | 17 |
| Driver App | 5 | 7 |
| Jobs | 3 | 18 |
| Trips | 4 | 24 |
| LR | 3 | 13 |
| E-Way Bills | 3 | 20 |
| Finance | 11 | 40+ |
| Banking | 1 | 10 |
| Fleet | 18 | 55+ |
| Tracking | 3 | 6 |
| Documents | 3 | 18 |
| Reports | 1 | 10 |
| Masters | 1 | 4 |
| Settings | 3 | 5 |
| Admin | 5 | 12 |
| Accountant | 10 | 35+ |
| Suppliers | 2 | 7 |
| Market Trips | 2 | 10 |
| Pump | 7 | 14 |
| Customer Portal | 3 | 8 |
| Supplier Portal | 2 | 5 |
| **TOTAL** | **~103 screens** | **~350+ endpoints** |
