# Kavya Transport ERP — Project Handover Document

Version: 1.0
Date: 2026-03-15
Project Root: `kavya_transport_erp-main/`

## 1. Project Overview

Kavya Transport ERP is a transport operations platform that manages the full workflow from client/job creation to LR, trip execution, tracking, fleet maintenance, finance, reporting, and role-based access control.

### What this system does
- Master data management: clients, vehicles, drivers, routes.
- Operations: jobs/orders, lorry receipts (LR), trip planning/execution, e-way bill workflow.
- Fleet: fuel, tyre, service/maintenance, alerts, utilization dashboards.
- Finance: invoices, payments, ledger, receivables/payables, banking entries.
- Tracking: live trip/vehicle visibility and tracking alerts.
- Reporting: operational and financial analytics endpoints/pages.
- Security: JWT auth + role/permission checks.

### Who uses it (6 roles)
- Admin
- Manager
- Fleet Manager
- Accountant
- Project Associate
- Driver

### Current status
- Web app: implemented and operational (backend + React frontend).
- Flutter mobile app: planned (Phase 7), not implemented in this repository.

---

## 2. Technology Stack

### Backend
- FastAPI
- SQLAlchemy (async)
- Alembic
- Pydantic v2 + pydantic-settings
- python-jose (JWT)
- passlib+bcrypt
- Uvicorn
- WebSocket support

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- TanStack Query
- Axios
- React Router v6
- Recharts
- Leaflet + react-leaflet
- lucide-react icons

### Databases
- PostgreSQL (primary transactional DB)
- MongoDB (logs, telemetry, tracking-related collections)
- Redis (infrastructure cache/broker dependency)

### Infrastructure / Integrations
- AWS S3 / MinIO compatible storage settings
- SMTP email settings
- Twilio SMS settings
- Firebase FCM server key setting
- GPS provider settings (internal/loconav/fleetx)

---

## 3. Project Structure

```text
kavya_transport_erp-main/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/        # All API route modules
│   │   ├── core/                    # Settings, JWT/auth utilities
│   │   ├── db/
│   │   │   ├── postgres/            # SQLAlchemy engines/sessions
│   │   │   └── mongodb/             # Motor client + index initialization
│   │   ├── middleware/              # RBAC permission dependencies
│   │   ├── models/
│   │   │   ├── postgres/            # ORM models/tables
│   │   │   └── mongodb/             # Mongo document model helpers
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── services/                # Business logic layer
│   │   ├── websocket/               # WebSocket manager
│   │   └── main.py                  # FastAPI entrypoint
│   ├── alembic/                     # Migration scripts
│   ├── tests/                       # Connectivity + end-to-end data flow tests
│   ├── seed_data.py                 # Full database reset + seed (roles/users/demo data)
│   ├── seed_permissions.py          # Permission + role_permission seeding
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/              # Reusable UI components/layout/auth
│   │   ├── pages/                   # Route-level pages (masters/ops/fleet/finance/etc.)
│   │   ├── services/                # API client and module service wrappers
│   │   ├── store/                   # Zustand stores
│   │   ├── styles/                  # Global CSS/Tailwind layers
│   │   ├── types/                   # Shared TS types/interfaces
│   │   ├── App.tsx                  # Route map
│   │   └── main.tsx                 # App bootstrap
│   ├── package.json
│   └── vite.config.ts
├── README.md
├── VERIFICATION_REPORT.md
└── HANDOVER.md
```

---

## 4. How To Run Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- npm 9+
- PostgreSQL 14+ (or compatible)
- MongoDB 6+ (or compatible)
- Redis 6+ (recommended for full infra parity)
- Git

### Step by step setup
1. Clone repo.
2. Create virtual environment.
3. Install backend dependencies.
4. Setup `.env` file in `backend/`.
5. Run database migrations.
6. Seed demo/bootstrap data.
7. Start backend.
8. Start Celery worker.
9. Start Celery beat scheduler.
10. Start frontend.

### Commands (Windows)
```powershell
# 1) Clone
cd C:\work
git clone <repo-url>
cd kavya_transport_erp-main\kavya_transport_erp-main

# 2) Create venv (if needed)
python -m venv ..\.venv

# 3) Activate venv
..\.venv\Scripts\Activate.ps1

# 4) Install backend deps
cd backend
pip install -r requirements.txt

# 5) Configure env
Copy-Item .env.example .env
# then edit backend\.env

# 6) Run migrations
alembic upgrade head

# 7) Seed data (full reset + demo users/data)
python seed_data.py

# 8) Seed permissions (recommended)
python seed_permissions.py

# 9) Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

# 10) Celery worker (planned; no Celery app module committed yet)
# celery -A app.celery_app worker --loglevel=info

# 11) Celery beat (planned; no beat schedule committed yet)
# celery -A app.celery_app beat --loglevel=info

# 12) Start frontend
cd ..\frontend
npm install
npm run dev
```

### Commands (Linux/Mac)
```bash
# 1) Clone
cd ~/work
git clone <repo-url>
cd kavya_transport_erp-main/kavya_transport_erp-main

# 2) Create venv
python3 -m venv ../.venv

# 3) Activate venv
source ../.venv/bin/activate

# 4) Install backend deps
cd backend
pip install -r requirements.txt

# 5) Configure env
cp .env.example .env
# then edit backend/.env

# 6) Run migrations
alembic upgrade head

# 7) Seed data
python seed_data.py
python seed_permissions.py

# 8) Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

# 9) Celery worker (planned)
# celery -A app.celery_app worker --loglevel=info

# 10) Celery beat (planned)
# celery -A app.celery_app beat --loglevel=info

# 11) Start frontend
cd ../frontend
npm install
npm run dev
```

### All startup commands summary
- Backend: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload`
- Frontend: `npm run dev`
- DB migration: `alembic upgrade head`
- Seed: `python seed_data.py`, `python seed_permissions.py`
- Celery worker/beat: planned commands only, implementation module pending.

---

## 5. Environment Variables

Source of truth: `backend/app/core/config.py` and `backend/.env.example`.

| Variable | Purpose | Example | Required |
|---|---|---|---|
| APP_NAME | API/app display name | Transport ERP | Optional |
| APP_VERSION | App version label | 1.0.0 | Optional |
| DEBUG | Debug mode | true | Optional |
| ENVIRONMENT | Runtime environment | development | Optional |
| API_V1_PREFIX | Base API prefix | /api/v1 | Optional |
| SECRET_KEY | JWT signing key | change-me-super-secret | Required |
| ALGORITHM | JWT algorithm | HS256 | Optional |
| ACCESS_TOKEN_EXPIRE_MINUTES | Access token TTL | 30 | Optional |
| REFRESH_TOKEN_EXPIRE_DAYS | Refresh token TTL | 7 | Optional |
| POSTGRES_HOST | Postgres host | localhost | Required |
| POSTGRES_PORT | Postgres port | 5432 | Required |
| POSTGRES_USER | Postgres user | transport_erp | Required |
| POSTGRES_PASSWORD | Postgres password | password | Required |
| POSTGRES_DB | Postgres database | transport_erp | Required |
| MONGODB_URL | Mongo connection URL | mongodb://localhost:27017 | Required |
| MONGODB_DB | Mongo database name | transport_erp_logs | Required |
| REDIS_HOST | Redis host | localhost | Recommended |
| REDIS_PORT | Redis port | 6379 | Recommended |
| REDIS_PASSWORD | Redis password | (empty) | Optional |
| REDIS_DB | Redis DB index | 0 | Optional |
| CORS_ORIGINS | Allowed frontend origins | ["http://localhost:5173","http://127.0.0.1:5173"] | Required |
| STORAGE_TYPE | File storage backend | local | Optional |
| STORAGE_BUCKET | Bucket/container name | transport-erp | Optional |
| AWS_ACCESS_KEY_ID | AWS key for S3 | AKIA... | Optional |
| AWS_SECRET_ACCESS_KEY | AWS secret | ... | Optional |
| AWS_REGION | AWS region | ap-south-1 | Optional |
| MINIO_ENDPOINT | MinIO endpoint | http://localhost:9000 | Optional |
| SMTP_HOST | SMTP server | smtp.gmail.com | Optional |
| SMTP_PORT | SMTP port | 587 | Optional |
| SMTP_USER | SMTP username | noreply@company.com | Optional |
| SMTP_PASSWORD | SMTP password/app key | xxx | Optional |
| EMAIL_FROM | Sender email | noreply@transporterp.com | Optional |
| SMS_PROVIDER | SMS provider selector | twilio | Optional |
| TWILIO_ACCOUNT_SID | Twilio account SID | AC... | Optional |
| TWILIO_AUTH_TOKEN | Twilio auth token | ... | Optional |
| TWILIO_PHONE_NUMBER | Twilio sender number | +1... | Optional |
| FCM_SERVER_KEY | Firebase server key | ... | Optional |
| GPS_PROVIDER | GPS integration mode | internal | Optional |
| GPS_API_KEY | GPS provider API key | ... | Optional |
| LOG_LEVEL | Logging verbosity | INFO | Optional |
| LOG_FORMAT | Logger format | %(asctime)s - ... | Optional |
| RATE_LIMIT_PER_MINUTE | API rate limit default | 100 | Optional |
| DEFAULT_PAGE_SIZE | Pagination default | 20 | Optional |
| MAX_PAGE_SIZE | Pagination max | 100 | Optional |

---

## 6. Database Information

### PostgreSQL
- Database name (default): `transport_erp`
- ORM table count discovered: 45

#### Tables
- `users`, `roles`, `permissions`, `user_role_assignments`, `role_permission_assignments`, `branches`, `tenants`
- `clients`, `client_contacts`, `client_addresses`
- `vehicles`, `vehicle_documents`, `vehicle_maintenance`, `vehicle_tyres`
- `drivers`, `driver_licenses`, `driver_documents`, `driver_attendance`
- `jobs`, `job_status_history`
- `lrs`, `lr_items`, `lr_documents`
- `trips`, `trip_expenses`, `trip_fuel_entries`, `trip_status_history`
- `routes`, `route_budgets`, `rate_charts`, `fuel_prices`
- `invoices`, `invoice_items`, `payments`, `ledger`, `gst_entries`, `vendors`, `receivables`, `payables`
- `bank_accounts`, `bank_transactions`
- `eway_bills`, `eway_items`
- `documents`, `document_versions`

#### Key relationships
- User RBAC: `users` ↔ `roles` through `user_role_assignments`.
- Role permissions: `roles` ↔ `permissions` through `role_permission_assignments`.
- Client to jobs/invoices: `clients` used by `jobs`, `invoices`, receivable/payable context.
- Job to LR/trip: one job can map to multiple `lrs` and `trips`.
- Trip to expenses/fuel/status history: `trip_expenses`, `trip_fuel_entries`, `trip_status_history`.
- Document versioning: `documents` ↔ `document_versions`.

### MongoDB
- Database name (default): `transport_erp_logs`

#### Collections
- `trip_tracking`
- `vehicle_telemetry`
- `fuel_sensor_logs`
- `audit_logs`
- `notification_logs`
- `alert_logs`
- `driver_checklist_logs`
- `analytics_snapshots`
- `report_cache`
- `ai_insights`
- `vehicle_health_scores`
- `driver_performance_scores`

#### TTL settings
- `vehicle_telemetry.timestamp`: 30 days
- `fuel_sensor_logs.timestamp`: 90 days
- `report_cache.expires_at`: TTL via `expireAfterSeconds=0`

### Redis
Current repository usage is infrastructure-oriented and limited in code-level explicit key management.

What Redis is intended/stored for:
- Connectivity checks (`/admin/health`)
- Celery broker/backend (planned usage)
- Caching/rate limiting hooks (config present)

Key patterns used:
- No strongly enforced application key namespace is currently implemented in the committed code.
- Recommended pattern for future work: `transport_erp:{module}:{id}`.

---

## 7. API Reference

Base URL: `/api/v1`

Standard response envelope:
```json
{
  "success": true,
  "data": {},
  "message": "",
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

Note: There are 200+ route decorators in endpoint modules including compatibility/alias routes. The list below covers the complete primary API surface used by the web app and integration tests, plus compatibility groups.

### 7.1 Authentication

| Method | Path | Permission | Purpose | Request Body | Response (`data`) |
|---|---|---|---|---|---|
| POST | /auth/login | Public | Authenticate user | `{ email, password }` | `{ access_token, refresh_token, token_type, user }` |
| POST | /auth/refresh | Public | Refresh access token | `{ refresh_token }` | `{ access_token, token_type }` |
| GET | /auth/me | Authenticated | Current profile | - | `UserInfo` |
| POST | /auth/change-password | Authenticated | Change password | `{ current_password, new_password }` | status message |
| POST | /auth/logout | Authenticated | Logout acknowledgment | - | status message |

### 7.2 Core Masters & Operations

| Method | Path | Permission | Purpose | Request Body | Response (`data`) |
|---|---|---|---|---|---|
| GET | /clients | `client:read` | List clients | - | list/paginated clients |
| POST | /clients | `client:create` | Create client | client fields | created client |
| GET | /clients/{id} | Authenticated | Client detail | - | client |
| PUT | /clients/{id} | `client:update` | Update client | patch fields | updated client |
| DELETE | /clients/{id} | `client:delete` | Delete client | - | success |
| GET | /clients/{id}/contacts | Authenticated | Client contacts | - | contact list |
| POST | /clients/{id}/contacts | Authenticated | Add contact | contact fields | created contact |
| DELETE | /clients/contacts/{contact_id} | Authenticated | Remove contact | - | success |
| GET | /vehicles | `vehicle:read` | List vehicles | - | list/paginated vehicles |
| POST | /vehicles | `vehicle:create` | Create vehicle | vehicle fields | created vehicle |
| GET | /vehicles/{id} | Authenticated | Vehicle detail | - | vehicle |
| PUT | /vehicles/{id} | `vehicle:update` | Update vehicle | patch fields | updated vehicle |
| DELETE | /vehicles/{id} | `vehicle:delete` | Delete vehicle | - | success |
| GET | /drivers | `driver:read` | List drivers | - | list/paginated drivers |
| POST | /drivers | `driver:create` | Create driver | driver fields | created driver |
| GET | /drivers/{id} | Authenticated | Driver detail | - | driver |
| PUT | /drivers/{id} | `driver:update` | Update driver | patch fields | updated driver |
| DELETE | /drivers/{id} | `driver:delete` | Delete driver | - | success |
| GET | /drivers/{id}/licenses | Authenticated | Driver licenses | - | list |
| POST | /drivers/{id}/licenses | Authenticated | Add license | license fields | created license |
| GET | /drivers/attendance | Authenticated | Attendance records | - | list |
| GET | /jobs | `job:read` | List jobs | - | list/paginated jobs |
| POST | /jobs | `job:create` | Create job | job fields | created job |
| GET | /jobs/{id} | Authenticated | Job detail | - | job |
| PUT | /jobs/{id} | `job:update` | Update job | patch fields | updated job |
| DELETE | /jobs/{id} | `job:delete` | Delete job | - | success |
| POST | /jobs/{id}/status | `job:update` | Change job status | `{ status, ... }` | updated job |
| PUT | /jobs/{id}/assign | `job:update` | Assign resource(s) | assignment fields | updated job |
| GET | /lr | `lr:read` | List LR | - | list/paginated LR |
| POST | /lr | `lr:create` | Create LR | LR fields | created LR |
| GET | /lr/{id} | Authenticated | LR detail | - | LR |
| PUT | /lr/{id} | `lr:update` | Update LR | patch fields | updated LR |
| DELETE | /lr/{id} | `lr:delete` | Delete LR | - | success |
| POST | /lr/{id}/status | `lr:update` | Change LR status | `{ status }` | updated LR |
| GET | /eway-bills | `eway:read` | List e-way bills | - | list |
| POST | /eway-bills | `eway:create` | Create e-way bill | e-way fields | created e-way bill |
| GET | /eway-bills/{id} | `eway:read` | E-way bill detail | - | e-way bill |
| PUT | /eway-bills/{id} | `eway:update` | Update e-way bill | patch fields | updated |
| DELETE | /eway-bills/{id} | `eway:delete` | Delete e-way bill | - | success |
| GET | /trips | `trip:read` | List trips | - | list/paginated trips |
| POST | /trips | `trip:create` | Create trip | trip fields + references | created trip |
| GET | /trips/{id} | Authenticated | Trip detail | - | trip |
| PUT | /trips/{id} | `trip:update` | Update trip | patch fields | updated trip |
| DELETE | /trips/{id} | `trip:delete` | Delete trip | - | success |
| POST | /trips/{id}/status | `trip:update` | Change trip status | `{ status }` | updated trip |
| PUT | /trips/{id}/start | `trip:update` | Start trip | optional metadata | updated trip |
| PUT | /trips/{id}/reach | `trip:update` | Mark reached | optional metadata | updated trip |
| PUT | /trips/{id}/close | `trip:update` | Close trip | optional metadata | updated trip |
| GET | /trips/{id}/expenses | Authenticated | Trip expenses | - | list |
| POST | /trips/{id}/expenses | `expense:create` | Add expense | `{ category, amount, payment_mode, expense_date, description }` | created expense |
| POST | /trips/expenses/{expense_id}/verify | `expense:approve` | Verify expense | verifier/action payload | updated expense |
| GET | /trips/{id}/fuel | Authenticated | Trip fuel entries | - | list |
| POST | /trips/{id}/fuel | Authenticated | Add fuel entry | fuel payload | created fuel entry |
| GET | /documents | `document:read` | List documents | - | list/paginated documents |
| POST | /documents | `document:create` | Upload/create document | document metadata | created document |
| GET | /documents/{id} | Authenticated | Document detail | - | document |
| PUT | /documents/{id} | `document:update` | Update document | patch fields | updated document |
| DELETE | /documents/{id} | `document:delete` | Delete document | - | success |

### 7.3 Finance

| Method | Path | Permission | Purpose | Request Body | Response (`data`) |
|---|---|---|---|---|---|
| GET | /finance/invoices | `invoice:read` | List invoices | - | list/paginated |
| POST | /finance/invoices | `invoice:create` | Create invoice | invoice + items | created invoice |
| GET | /finance/invoices/{id} | Authenticated | Invoice detail | - | invoice |
| PUT | /finance/invoices/{id} | `invoice:update` | Update invoice | patch fields | updated |
| DELETE | /finance/invoices/{id} | `invoice:delete` | Delete invoice | - | success |
| GET | /finance/payments | `payment:read` | List payments | - | list |
| POST | /finance/payments | `payment:create` | Create payment | payment fields | created payment |
| GET | /finance/ledger | `ledger:read` | List ledger entries | - | list |
| POST | /finance/ledger | Authenticated | Create ledger entry | ledger fields | created entry |
| GET | /finance/vendors | Authenticated | List vendors | - | list |
| POST | /finance/vendors | Authenticated | Create vendor | vendor fields | created vendor |
| GET | /finance/bank-accounts | Authenticated | List bank accounts | - | list |
| POST | /finance/bank-accounts | Authenticated | Create bank account | account fields | created account |
| GET | /finance/bank-transactions | Authenticated | List bank transactions | - | list |
| POST | /finance/bank-transactions | Authenticated | Create bank transaction | transaction fields | created transaction |
| GET | /finance/routes | Authenticated | List route masters | - | list |
| GET | /finance/routes/{id} | Authenticated | Route detail | - | route |
| POST | /finance/routes | Authenticated | Create route | route fields | created route |
| PUT | /finance/routes/{id} | Authenticated | Update route | patch fields | updated route |

### 7.4 Tracking, Reports, Dashboard, Fleet/Accountant, Admin

| Method | Path | Permission | Purpose | Request Body | Response (`data`) |
|---|---|---|---|---|---|
| GET | /tracking/live | Authenticated | Live tracking snapshot | - | map payload |
| GET | /tracking/active-trips | Authenticated | Active trips list | - | list |
| GET | /tracking/trip/{trip_id} | Authenticated | Trip tracking detail | - | tracking details |
| GET | /tracking/vehicle/{vehicle_id} | Authenticated | Vehicle tracking detail | - | tracking details |
| GET | /tracking/alerts | Authenticated | Tracking alerts | - | list |
| POST | /tracking/alerts/{alert_id}/acknowledge | Authenticated | Acknowledge alert | optional note | updated alert |
| GET | /reports/dashboard | Authenticated | Reports dashboard summary | - | KPIs |
| GET | /reports/revenue-chart | `report:view` | Revenue chart | - | chart data |
| GET | /reports/trip-summary | `report:view` | Trip summary report | - | report data |
| GET | /reports/vehicle-performance | `report:view` | Vehicle performance report | - | report data |
| GET | /reports/driver-performance | `report:view` | Driver performance report | - | report data |
| GET | /reports/fuel-analysis | `report:view` | Fuel analysis report | - | report data |
| GET | /reports/revenue-analysis | `report:view` | Revenue analysis report | - | report data |
| GET | /reports/expense-analysis | `report:view` | Expense analysis report | - | report data |
| GET | /reports/route-analysis | `report:view` | Route analysis report | - | report data |
| GET | /reports/client-outstanding | `report:view` | Outstanding by client | - | report data |
| GET | /dashboard/overview | Authenticated | Main dashboard overview | - | KPI blocks |
| GET | /dashboard/fleet-stats | Authenticated | Fleet metrics | - | stats |
| GET | /dashboard/trip-stats | Authenticated | Trip metrics | - | stats |
| GET | /dashboard/finance-stats | Authenticated | Finance metrics | - | stats |
| GET | /dashboard/notifications | Authenticated | Notification feed | - | list |
| POST | /dashboard/notifications/{id}/read | Authenticated | Mark notification read | - | success |
| GET | /fleet/dashboard | Authenticated | Fleet dashboard | - | dashboard data |
| GET | /fleet/vehicles | Authenticated | Fleet vehicles | - | list |
| GET | /fleet/trips | Authenticated | Fleet trips | - | list |
| GET | /fleet/expiring-documents | Authenticated | Compliance expiries | - | list |
| GET | /accountant/dashboard | Authenticated | Accountant dashboard | - | KPIs |
| GET | /accountant/invoices | Authenticated | Accountant invoice view | - | list |
| GET | /accountant/payments | Authenticated | Accountant payments view | - | list |
| GET | /accountant/ledger | Authenticated | Accountant ledger view | - | list |
| GET | /accountant/receivables | Authenticated | Receivables view | - | list |
| GET | /accountant/expenses | Authenticated | Expense verification view | - | list |
| GET | /accountant/banking | Authenticated | Banking overview | - | list |
| GET | /admin/health | Admin role | Infra health (postgres/mongo/redis/celery) | - | status map |

### 7.5 Compatibility & Alias endpoints

`compat.py` and `aliases.py` expose compatibility endpoints such as:
- `/routes`, `/ewb`, `/expenses`, `/fuel`, `/attendance`, `/checklists`, `/invoices`, `/banking`, `/ledger`, `/notifications`, `/notifications/unread-count`
- Additional compatibility routes for fleet/accountant dashboard widgets and lookup data.

These routes wrap existing data/services to preserve frontend contract compatibility.

---

## 8. User Roles & Permissions

Canonical role-permission map is in `backend/app/middleware/permissions.py` (`ROLE_PERMISSIONS`).

| Role | Access Summary |
|---|---|
| Admin | Wildcard (`*`) full system access |
| Manager | Broad operations/fleet/report/document permissions |
| Fleet Manager | Trips + vehicle/driver + fuel/maintenance/tracking |
| Accountant | Invoice/payment/ledger + finance reads + expense approvals |
| Project Associate | Job/LR/trip create+update + read masters/documents |
| Driver | Own-work style trip/expense/fuel/document limited permissions |

Permission examples:
- `client:create`, `client:read`, `client:update`, `client:delete`
- `job:*`, `lr:*`, `trip:*`
- `invoice:*`, `payment:*`, `ledger:read`
- `tracking:view`, `tracking:live`
- `document:*`

---

## 9. Frontend Pages

Routes come from `frontend/src/App.tsx` (65 route entries found). Access roles are based on nav configuration and route intent.

| Route | Component file | Intended role access | Primary API namespaces |
|---|---|---|---|
| /dashboard | src/pages/dashboard/DashboardPage.tsx | All authenticated | `/dashboard`, `/reports` |
| /clients | src/pages/clients/ClientsPage.tsx | Admin, Manager | `/clients` |
| /clients/:id | src/pages/clients/ClientDetailPage.tsx | Admin, Manager | `/clients/{id}` |
| /vehicles | src/pages/vehicles/VehiclesPage.tsx | Admin, Manager, Fleet Manager | `/vehicles` |
| /vehicles/:id | src/pages/vehicles/VehicleDetailPage.tsx | Admin, Manager, Fleet Manager | `/vehicles/{id}` |
| /drivers | src/pages/drivers/DriversPage.tsx | Admin, Manager, Fleet Manager | `/drivers` |
| /drivers/dashboard | src/pages/drivers/DriverDashboardPage.tsx | Admin, Manager, Fleet Manager | `/drivers`, `/dashboard` |
| /drivers/:id | src/pages/drivers/DriverDetailPage.tsx | Admin, Manager, Fleet Manager | `/drivers/{id}` |
| /driver/trips | src/pages/driver/DriverTripsPage.tsx | Driver | `/trips` |
| /driver/attendance | src/pages/driver/DriverAttendancePage.tsx | Driver | `/attendance` alias/compat |
| /driver/expenses | src/pages/driver/DriverExpensesPage.tsx | Driver | `/trips/{id}/expenses`, `/expenses` alias |
| /driver/documents | src/pages/driver/DriverDocumentsPage.tsx | Driver | `/documents` |
| /jobs | src/pages/jobs/JobsPage.tsx | Admin, Manager, Project Associate | `/jobs`, `/vehicles`, `/drivers` |
| /jobs/new | src/pages/jobs/CreateJobPage.tsx | Admin, Manager, Project Associate | `/jobs`, lookup APIs |
| /jobs/:id/edit | src/pages/jobs/CreateJobPage.tsx | Admin, Manager, Project Associate | `/jobs/{id}` |
| /jobs/:id | src/pages/jobs/JobDetailPage.tsx | Admin, Manager, Project Associate | `/jobs/{id}` |
| /lr | src/pages/lr/LRListPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/lr` |
| /lr/new | src/pages/lr/CreateLRPage.tsx | Admin, Manager, Project Associate | `/lr`, `/jobs` |
| /lr/:id/edit | src/pages/lr/CreateLRPage.tsx | Admin, Manager, Project Associate | `/lr/{id}` |
| /lr/:id | src/pages/lr/LRDetailPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/lr/{id}` |
| /lr/eway-bill | src/pages/eway-bill/EwayBillListPage.tsx | Admin, Manager, Project Associate | `/eway-bills` |
| /lr/eway-bill/new | src/pages/eway-bill/GenerateEwayBillPage.tsx | Admin, Manager, Project Associate | `/eway-bills`, `/lr` |
| /lr/eway-bill/:id/edit | src/pages/eway-bill/GenerateEwayBillPage.tsx | Admin, Manager, Project Associate | `/eway-bills/{id}` |
| /lr/eway-bill/:id | src/pages/eway-bill/EwayBillDetailPage.tsx | Admin, Manager, Project Associate | `/eway-bills/{id}` |
| /trips | src/pages/trips/TripsPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/trips`, `/jobs`, `/lr` |
| /trips/new | src/pages/trips/CreateTripPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/trips` |
| /trips/:id/edit | src/pages/trips/CreateTripPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/trips/{id}` |
| /trips/:id | src/pages/trips/TripDetailPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/trips/{id}` |
| /documents | src/pages/documents/DocumentListPage.tsx | Admin, Manager, Project Associate | `/documents` |
| /documents/upload | src/pages/documents/UploadDocumentPage.tsx | Admin, Manager, Project Associate | `/documents` |
| /documents/:id/edit | src/pages/documents/UploadDocumentPage.tsx | Admin, Manager, Project Associate | `/documents/{id}` |
| /finance/invoices | src/pages/finance/InvoicesPage.tsx | Admin, Manager, Accountant | `/finance/invoices` |
| /finance/payments | src/pages/finance/PaymentsPage.tsx | Admin, Manager, Accountant | `/finance/payments` |
| /finance/ledger | src/pages/finance/LedgerPage.tsx | Admin, Manager, Accountant | `/finance/ledger` |
| /finance/receivables | src/pages/finance/ReceivablesPage.tsx | Admin, Manager, Accountant | `/finance/receivables` compat |
| /finance/payables | src/pages/finance/PayablesPage.tsx | Admin, Manager, Accountant | `/finance/payables` compat |
| /finance/banking/new | src/pages/finance/BankingEntryPage.tsx | Admin, Manager, Accountant | `/finance/bank-*`, compat banking |
| /tracking | src/pages/tracking/LiveTrackingPage.tsx | Admin, Manager, Fleet Manager, Project Associate | `/tracking/live`, `/tracking/*` |
| /alerts | src/pages/fleet/FleetAlertsPage.tsx | Admin, Manager, Fleet Manager | `/tracking/alerts`, `/notifications` |
| /reports | src/pages/reports/ReportsPage.tsx | Admin, Manager, Fleet Manager, Accountant | `/reports/*` |
| /settings | src/pages/settings/SettingsPage.tsx | All authenticated (intended privileged) | settings/local state + APIs as added |
| /fleet/dashboard, /fleet | src/pages/fleet/FleetDashboardPage.tsx | Admin, Fleet Manager | `/fleet/*`, `/dashboard/*` |
| /fleet/vehicles | src/pages/fleet/FleetVehiclesPage.tsx | Admin, Fleet Manager | `/fleet/vehicles`, `/vehicles` |
| /fleet/vehicles/:id | src/pages/fleet/FleetVehiclesPage.tsx | Admin, Fleet Manager | `/vehicles/{id}` |
| /fleet/drivers | src/pages/fleet/FleetDriversPage.tsx | Admin, Fleet Manager | `/fleet/drivers`, `/drivers` |
| /fleet/drivers/:id | src/pages/fleet/FleetDriversPage.tsx | Admin, Fleet Manager | `/drivers/{id}` |
| /fleet/tracking | src/pages/fleet/FleetTrackingPage.tsx | Admin, Fleet Manager | `/tracking/*` |
| /fleet/maintenance | src/pages/fleet/ServicePage.tsx | Admin, Fleet Manager | `/service` |
| /fleet/fuel | src/pages/fleet/FuelPage.tsx | Admin, Fleet Manager | `/fuel` |
| /fleet/tyres | src/pages/fleet/TyrePage.tsx | Admin, Fleet Manager | `/tyre` |
| /fleet/alerts | src/pages/fleet/FleetAlertsPage.tsx | Admin, Fleet Manager | `/tracking/alerts` |
| /fleet/reports | src/pages/fleet/FleetReportsPage.tsx | Admin, Fleet Manager | `/reports/*` |
| /routes | src/pages/masters/RoutesPage.tsx | Admin, Manager | `/routes` alias, `/finance/routes` |
| /accountant/dashboard, /accountant | src/pages/accountant/AccountantDashboardPage.tsx | Admin, Accountant | `/accountant/dashboard/*` compat |
| /accountant/invoices | src/pages/accountant/AccountantInvoicesPage.tsx | Admin, Accountant | `/finance/invoices`, `/accountant/invoices` |
| /accountant/receivables | src/pages/accountant/AccountantReceivablesPage.tsx | Admin, Accountant | `/finance/receivables` compat |
| /accountant/payables | src/pages/accountant/AccountantPayablesPage.tsx | Admin, Accountant | `/finance/payables` compat |
| /accountant/expenses | src/pages/accountant/AccountantExpensesPage.tsx | Admin, Accountant | `/expenses`, `/trips/*/expenses` |
| /accountant/fuel | src/pages/accountant/AccountantFuelExpensePage.tsx | Admin, Accountant | `/fuel`, accountant compat |
| /accountant/banking | src/pages/accountant/AccountantBankingPage.tsx | Admin, Accountant | `/finance/bank-*`, accountant compat |
| /accountant/ledger | src/pages/accountant/AccountantLedgerPage.tsx | Admin, Accountant | `/finance/ledger` |
| /accountant/reports | src/pages/accountant/AccountantReportsPage.tsx | Admin, Accountant | `/reports/*`, accountant compat |
| /admin/connectivity | src/pages/admin/ConnectivityPage.tsx | Admin only (route guard) | `/admin/health` |
| /admin/users | src/pages/admin/ConnectivityPage.tsx | Admin only (route guard) | admin management placeholders |
| * | src/pages/common/NotFoundPage.tsx | Any | - |

---

## 10. Background Tasks (Celery)

Current status in this repository:
- No committed `celery_app` module.
- No committed `@shared_task` task definitions.
- No committed beat schedule.
- `admin/health` checks Celery worker availability via runtime `celery` import and ping.

### Scheduled tasks table (current)

| Task name | Schedule | What it does | Notified users |
|---|---|---|---|
| None committed | N/A | Celery integration scaffold only | N/A |

### Planned task candidates
- Document expiry reminders.
- Maintenance due alerts.
- Daily/weekly KPI digest.
- Failed trip/expense exception notifications.

---

## 11. Known Issues & Workarounds

| Issue | Impact | Workaround |
|---|---|---|
| Backend on port 8001 can fail if stale process bound | Server start failure | Kill listener on 8001 or run another port (e.g., 8002) |
| Frontend may switch from 5173 to 5174 when 5173 busy | URL confusion | Use displayed Vite URL and ensure backend CORS includes active origin |
| Alias/compat routes can shadow core routes if duplicate signatures are introduced | Unexpected handler resolution | Avoid adding duplicate method+path in alias and core modules |
| Celery worker/beat not implemented as committed app module | Cannot run background worker/beat commands | Treat as planned; implement `app/celery_app.py` + tasks before enabling |
| Docker Compose not present | No one-command production stack | Use manual process deployment or add compose files |
| Seed script (`seed_data.py`) resets full schema | Data loss in local DB if run on active data | Use only on dev/test DB; never run against production |
| Auth permission model recently evolved (roles + permissions in JWT) | Old tokens may miss `permissions` claim | Re-login after backend update to mint fresh JWT |

---

## 12. What Is Complete

- [x] FastAPI backend with modular endpoint architecture.
- [x] React+TypeScript frontend with route-level pages.
- [x] PostgreSQL ORM models and Alembic baseline migration.
- [x] MongoDB connection + indexes + TTL on telemetry/report cache collections.
- [x] JWT authentication with refresh token flow.
- [x] RBAC with 6 roles and permission map.
- [x] Permission claim included in JWT + permission-aware middleware checks.
- [x] Core CRUD flows for clients, vehicles, drivers, jobs, LR, trips.
- [x] Finance modules (invoice/payment/ledger/receivable/payable endpoints + pages).
- [x] Fleet/fuel/tyre/service route families and pages.
- [x] Dashboard/report/tracking route families.
- [x] Health and verification scripts (`test_full_connectivity.py`, `test_data_flow.py`).
- [x] Seed scripts for bootstrap/demo and permissions.

---

## 13. What Is Not Complete (Future Work)

- Flutter mobile app (Phase 7).
- Production-grade Celery task module and beat schedules.
- VAHAN API integration.
- Government e-way bill API integration hardening.
- WhatsApp notifications integration.
- FASTag integration.
- Deployment automation (Docker Compose/Kubernetes manifests).
- Strong Redis key namespace strategy + application-level caching/blacklist flows.
- Expanded automated test coverage (unit/integration/contract).

---

## 14. Third Party Services

| Service | Used for | Configuration keys | Free tier notes | Registration |
|---|---|---|---|---|
| AWS S3 | File/object storage | `STORAGE_TYPE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `STORAGE_BUCKET` | Varies by region; limited free tier period | https://aws.amazon.com |
| MinIO | Self-hosted S3-compatible storage | `STORAGE_TYPE=minio`, `MINIO_ENDPOINT`, bucket/access keys | Self-hosted; no cloud free tier dependency | https://min.io |
| SMTP (Gmail or provider) | Email notifications | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Provider-dependent | Provider portal |
| Twilio | SMS notifications | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Trial credits available | https://www.twilio.com |
| Firebase Cloud Messaging | Push notifications | `FCM_SERVER_KEY` | Spark plan available | https://firebase.google.com |
| GPS provider (Loconav/Fleetx/Internal) | Vehicle location integration | `GPS_PROVIDER`, `GPS_API_KEY` | Provider-dependent | Provider portal |

---

## 15. Deployment Instructions

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python seed_permissions.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001

# Frontend
cd ../frontend
npm install
npm run build
npm run preview
```

### Production Deployment

Current repository status:
- No committed `docker-compose.yml` found.

Recommended production path right now:
1. Run backend with process manager (systemd/pm2/supervisor) behind Nginx.
2. Build frontend static bundle and serve via Nginx.
3. Use managed PostgreSQL/MongoDB/Redis.

#### Docker compose commands (when compose files are added)
```bash
docker compose build
docker compose up -d
docker compose logs -f
docker compose down
```

#### Production environment notes
- Set `DEBUG=false`.
- Set strong `SECRET_KEY`.
- Set strict `CORS_ORIGINS` to production domains.
- Configure DB credentials and TLS.
- Configure storage credentials (S3/MinIO).
- Configure SMTP/SMS/FCM secrets.

#### Nginx configuration notes
- Reverse proxy `/api/` and `/ws/` to FastAPI backend.
- Serve frontend static files from `/`.
- Enable WebSocket upgrades for tracking/notifications channels.
- Add request size limits appropriate for document upload.
- Set security headers and TLS certs.

---

## 16. Testing

### Script 1: Connectivity test
```bash
cd backend
python tests/test_full_connectivity.py
```
Expected output pattern:
- Successful login for available role credentials.
- Endpoint status checks with `OK` for reachable APIs.
- Final summary line: `RESULTS: <passed> passed, <failed> failed`.

### Script 2: End-to-end data flow
```bash
cd backend
python tests/test_data_flow.py
```
Expected output pattern:
- `OK Client created and readable`
- `OK Vehicle created and readable`
- `OK Driver created and readable`
- `OK Job created and readable`
- `OK LR created and readable`
- `OK Trip created and readable`
- `OK Expense created and readable`
- `OK Invoice created and readable`
- Final line: `SUCCESS: End-to-end data flow checks passed`

---

## 17. Demo Credentials

From `seed_data.py`:

| Email | Password | Role | Access summary |
|---|---|---|---|
| admin@kavyatransports.com | admin123 | admin | Full system |
| manager@kavyatransports.com | demo123 | manager | Ops + fleet + accountant views |
| fleet@kavyatransports.com | demo123 | fleet_manager | Fleet/trip/tracking focus |
| accountant@kavyatransports.com | demo123 | accountant | Finance focus |
| pa@kavyatransports.com | demo123 | project_associate | Job/LR/trip/document operations |
| driver@kavyatransports.com | demo123 | driver | Driver work pages |

Note: If accounts do not exist in your local DB, run `python seed_data.py`.

---

## 18. Client Demo Script

Suggested demo order (30-45 minutes):

1. Login as Admin.
2. Show dashboard KPIs and alerts.
3. Go to Masters: create/view client, vehicle, driver.
4. Create Job.
5. Create LR linked to job.
6. Create Trip linked to job/LR/vehicle/driver.
7. Use trip actions (start/reach/close) to demonstrate workflow.
8. Open live tracking page and show map/tracking feed.
9. Add trip expense and show verification flow.
10. Generate invoice and show finance pages (payments/ledger).
11. Show reports section and at least 2 analytics views.
12. Switch to Fleet Manager account and show fleet dashboard + tyre/service/fuel pages.
13. Switch to Accountant account and show accountant dashboard/reports.
14. Switch to Driver account and show driver work pages.
15. Show admin connectivity health check page.

---

## 19. Contact & Support

### Development ownership
- Primary implementation is in this repository under:
  - `backend/` for API/data layer
  - `frontend/` for UI/client layer

### Bug reporting
- Open issue in your internal tracker/Git platform with:
  - Steps to reproduce
  - Expected vs actual behavior
  - API endpoint/route affected
  - Logs/screenshots
  - Environment info (`.env` non-secret context, branch, commit)

### Documentation locations
- `README.md` (high-level reference)
- `VERIFICATION_REPORT.md` (installation and environment verification)
- `HANDOVER.md` (this document)

### Recommended next maintenance tasks
1. Add real Celery app + task modules and beat schedule.
2. Add Docker Compose and production deployment templates.
3. Expand API contract docs (OpenAPI examples per endpoint).
4. Add CI pipeline for tests + lint + type checks.
