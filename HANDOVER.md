# Kavya Transport ERP — Comprehensive Project Handover

**Version:** 2.0  
**Date:** 2025-07-24  
**Project Root:** `kavya_transport_erp/`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Setup & Installation](#4-setup--installation)
5. [Environment Variables](#5-environment-variables)
6. [Database](#6-database)
7. [Authentication & Roles](#7-authentication--roles)
8. [Permission System](#8-permission-system)
9. [Backend API Reference](#9-backend-api-reference)
10. [Backend Models](#10-backend-models)
11. [Backend Services](#11-backend-services)
12. [Frontend (React)](#12-frontend-react)
13. [Flutter Driver App](#13-flutter-driver-app)
14. [Seed Data](#14-seed-data)
15. [Tests](#15-tests)
16. [External Integrations](#16-external-integrations)
17. [WebSocket](#17-websocket)
18. [Known Issues & Limitations](#18-known-issues--limitations)
19. [Demo Credentials](#19-demo-credentials)
20. [Demo Walkthrough](#20-demo-walkthrough)

---

## 1. Project Overview

Kavya Transport ERP is a full-stack transport operations platform managing the complete workflow:

**Client → Job → LR (Lorry Receipt) → E-way Bill → Trip → Tracking → Invoice → Payment**

### Key Capabilities
- **Operations**: Job booking, LR generation, trip management, route planning
- **Fleet Management**: Vehicle tracking, maintenance scheduling, tyre management, fuel monitoring, compliance alerts
- **Finance**: Invoicing (GST-compliant), payments, ledger, receivables/payables, banking, expense management
- **Compliance**: VAHAN vehicle verification, Sarathi DL verification, eChallan lookup, E-way Bill portal, GST verification
- **Tracking**: Live GPS tracking, geofencing, trip replay, driver behaviour analytics
- **Multi-Role Access**: Admin, Manager, Fleet Manager, Accountant, Project Associate, Driver — each with dedicated dashboards and permissions
- **Mobile App**: Flutter driver app with role-based navigation for drivers, fleet managers, accountants, and project associates

### Current Status: **WORKING**
- ✅ Backend: FastAPI with 150+ API endpoints — all operational
- ✅ Frontend: React 18 with 73 pages, 0 TypeScript errors, builds successfully (2822 modules)
- ✅ Flutter App: 86 Dart files with 4 role-based navigation shells — implemented
- ✅ Database: PostgreSQL (45 tables) + MongoDB (11 collections) — seeded with demo data
- ✅ Authentication: JWT-based with role-permission system — working
- ✅ All 6 user roles can login and access their dashboards

---

## 2. Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI (Python 3.12+) |
| ORM | SQLAlchemy 2.0 (async) |
| Validation | Pydantic v2 |
| Auth | python-jose (JWT HS256) |
| PostgreSQL Driver | asyncpg (async) / psycopg2 (sync migrations) |
| MongoDB Driver | Motor (async) / PyMongo |
| Redis | redis-py |
| Migrations | Alembic |
| Task Queue | Celery (configured, broker=Redis) |
| Server | Uvicorn |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | TailwindCSS |
| State Management | Zustand |
| Data Fetching | TanStack Query (React Query) |
| HTTP Client | Axios |
| Routing | React Router v6 |
| Charts | Recharts |
| Maps | Leaflet + React-Leaflet |
| Icons | Lucide React |

### Flutter Driver App
| Component | Technology |
|-----------|-----------|
| Framework | Flutter 3.x (Dart) |
| State Management | Riverpod |
| Routing | GoRouter |
| Offline Storage | Hive |
| Maps | Google Maps Flutter |
| Push Notifications | Firebase Cloud Messaging |
| Secure Storage | flutter_secure_storage |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL 15+ |
| Document Store | MongoDB 6+ |
| Cache/Broker | Redis 7+ |
| File Storage | Local / S3 / MinIO |

---

## 3. Project Structure

```
kavya_transport_erp/
├── backend/                    # FastAPI backend
│   ├── alembic.ini             # Alembic migration config
│   ├── pytest.ini              # Test configuration
│   ├── requirements.txt        # Python dependencies
│   ├── seed_data.py            # Database seeder (users, clients, vehicles, etc.)
│   ├── seed_permissions.py     # Permission seeder
│   ├── alembic/
│   │   └── versions/           # Migration scripts
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── celery_app.py       # Celery configuration
│   │   ├── api/v1/endpoints/   # 30 endpoint files (150+ routes)
│   │   ├── core/
│   │   │   ├── config.py       # Settings (env vars)
│   │   │   └── security.py     # JWT, password hashing
│   │   ├── db/
│   │   │   ├── postgres/       # SQLAlchemy connection, base
│   │   │   └── mongodb/        # Motor connection, indexes
│   │   ├── middleware/
│   │   │   └── permissions.py  # Role-permission enforcement
│   │   ├── models/
│   │   │   ├── postgres/       # 45 SQLAlchemy ORM models
│   │   │   └── mongodb/        # MongoDB document schemas
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # 25 business logic services
│   │   ├── tasks/              # Celery async tasks
│   │   ├── utils/              # Utility functions
│   │   └── websocket/          # WebSocket handlers
│   └── tests/                  # 12 test files
│
├── frontend/                   # React SPA
│   ├── package.json
│   ├── vite.config.ts          # Vite config with API proxy
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx             # Router with 65+ routes
│       ├── main.tsx            # Entry point
│       ├── components/         # Reusable UI components
│       ├── pages/              # 73 page components
│       ├── services/           # API, auth, data, WebSocket services
│       ├── store/              # Zustand stores (auth, app)
│       ├── styles/             # TailwindCSS styles
│       ├── types/              # TypeScript type definitions
│       └── utils/              # Utility functions
│
├── flutter_driver_app/         # Flutter mobile app
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart           # App entry point
│       ├── config/             # API config, themes, router
│       ├── models/             # Data models
│       ├── providers/          # Riverpod providers
│       ├── screens/            # 30+ screens (4 role-based shells)
│       ├── services/           # API, auth, location, notification services
│       └── widgets/            # Reusable widgets
│
├── HANDOVER.md                 # This file
└── CLIENT_GUIDE.md             # Client-facing guide
```

---

## 4. Setup & Installation

### Prerequisites
- Python 3.12+
- Node.js 18+ / npm 9+
- PostgreSQL 15+
- MongoDB 6+
- Redis 7+
- Flutter 3.x (for mobile app)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create PostgreSQL database
createdb kavya_transports_db
# Or: psql -c "CREATE DATABASE kavya_transports_db;"

# Run migrations
alembic upgrade head

# Seed demo data
python seed_data.py

# Start server (development)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
# Runs on http://localhost:3000 (or 5173)

# Production build
npm run build
```

### Flutter App Setup

```bash
cd flutter_driver_app

# Get dependencies
flutter pub get

# Run on device/emulator
flutter run

# Build APK
flutter build apk --release
```

### Vite Proxy Configuration

The frontend proxies API calls to the backend (defined in `vite.config.ts`):
- `/api` → `http://localhost:8000`
- `/ws` → `ws://localhost:8000`

---

## 5. Environment Variables

Create `.env` in the `backend/` directory:

### Core Settings
| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_NAME` | "Transport ERP" | Application name |
| `DEBUG` | False | Debug mode |
| `ENVIRONMENT` | "development" | Environment |
| `SECRET_KEY` | (set this) | JWT signing secret |
| `ALGORITHM` | "HS256" | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token TTL |

### Database
| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_HOST` | "localhost" | PostgreSQL host |
| `POSTGRES_PORT` | 5432 | PostgreSQL port |
| `POSTGRES_USER` | "transport_erp" | PostgreSQL user |
| `POSTGRES_PASSWORD` | "password" | PostgreSQL password |
| `POSTGRES_DB` | "transport_erp" | Database name |
| `MONGODB_URL` | "mongodb://localhost:27017" | MongoDB URL |
| `MONGODB_DB` | "transport_erp_logs" | MongoDB database |
| `REDIS_HOST` | "localhost" | Redis host |
| `REDIS_PORT` | 6379 | Redis port |

### External APIs
| Variable | Default | Purpose |
|----------|---------|---------|
| `VAHAN_API_KEY` | — | Vehicle verification (VAHAN portal) |
| `SARATHI_API_KEY` | — | DL verification (Sarathi portal) |
| `ECHALLAN_API_KEY` | — | Traffic challan lookup |
| `EWAY_BILL_USERNAME` | — | E-way Bill portal login |
| `EWAY_BILL_PASSWORD` | — | E-way Bill portal password |
| `EWAY_BILL_GSTIN` | — | Company GSTIN for E-way Bills |
| `GST_VERIFY_API_KEY` | — | GSTIN verification |
| `GOOGLE_MAPS_API_KEY` | — | Google Maps (routing, geocoding) |

### Notifications
| Variable | Default | Purpose |
|----------|---------|---------|
| `FIREBASE_CREDENTIALS_PATH` | — | FCM service account JSON |
| `FCM_SERVER_KEY` | — | Firebase push notifications |
| `MSG91_API_KEY` | — | SMS provider |
| `MSG91_SENDER_ID` | "KAVYAT" | SMS sender ID |
| `WHATSAPP_API_KEY` | — | Gupshup WhatsApp API |
| `WHATSAPP_SOURCE_NUMBER` | — | WhatsApp source number |

### Payments & Storage
| Variable | Default | Purpose |
|----------|---------|---------|
| `RAZORPAY_KEY_ID` | — | Razorpay payment gateway |
| `RAZORPAY_KEY_SECRET` | — | Razorpay secret |
| `STORAGE_TYPE` | "local" | File storage (local/s3/minio) |
| `AWS_ACCESS_KEY_ID` | — | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | — | S3 secret key |
| `AWS_S3_BUCKET` | — | S3 bucket name |
| `AWS_REGION` | "ap-south-1" | AWS region |

---

## 6. Database

### PostgreSQL

**Database:** `kavya_transports_db` (or `transport_erp` per env)  
**Driver:** asyncpg (async), psycopg2 (sync for Alembic)  
**Pool:** size=20, max_overflow=10, pool_pre_ping=True  
**Tables:** 45 ORM tables (see Section 10 for full list)

Key design patterns:
- `TimestampMixin` — `created_at`, `updated_at` on all tables
- `SoftDeleteMixin` — `is_deleted`, `deleted_at` for soft deletes
- UUID primary keys throughout
- Multi-tenant support via `tenant_id` on core entities

### MongoDB

**Database:** `transport_erp_logs`  
**Driver:** Motor (async)  
**Pool:** maxPoolSize=50, minPoolSize=10  
**Collections:** 11 with TTL and geospatial indexes

| Collection | Purpose | Indexes |
|-----------|---------|---------|
| `trip_tracking` | GPS tracking trails | trip_id, vehicle_id, driver_id |
| `vehicle_telemetry` | Real-time sensor data | vehicle_id, 30-day TTL, geospatial |
| `fuel_sensor_logs` | Fuel level readings | vehicle_id, 90-day TTL |
| `audit_logs` | Immutable audit trail | user_id, action, timestamp |
| `notification_logs` | Notification delivery | user_id, status |
| `alert_logs` | System alerts | severity, acknowledged |
| `analytics_snapshots` | Pre-computed dashboard data | snapshot_type, date |
| `document_upload_logs` | Upload attempts | document_id, outcome |
| `document_activity_logs` | Document workflow | document_id, action |
| `driver_checklist_logs` | Pre-trip checklists | driver_id, trip_id |

### Redis

**URL:** `redis://localhost:6379/0`  
**Usage:** Caching layer, Celery broker

---

## 7. Authentication & Roles

### JWT Authentication
- **Algorithm:** HS256
- **Access Token:** 30-minute expiry
- **Refresh Token:** 7-day expiry
- **Permissions:** Embedded in JWT payload
- **Header:** `Authorization: Bearer <token>`

### Login Flow
1. `POST /api/v1/auth/login` with `{email, password}`
2. Returns `{access_token, refresh_token, token_type, user, permissions}`
3. Frontend stores tokens, attaches to all API requests
4. Auto-refresh via `/api/v1/auth/refresh`

### Roles (6 total)

| Role | Login Email | Dashboard Route |
|------|-------------|----------------|
| **Admin** | admin@kavyatransports.com | `/dashboard` |
| **Manager** | manager@kavyatransports.com | `/dashboard` |
| **Fleet Manager** | fleet@kavyatransports.com | `/fleet/dashboard` |
| **Accountant** | accountant@kavyatransports.com | `/accountant/dashboard` |
| **Project Associate** | pa@kavyatransports.com | `/dashboard` (PA variant) |
| **Driver** | driver@kavyatransports.com | `/driver/trips` |

### Driver Auto-Creation
When a driver is created via `POST /api/v1/drivers`, a user account is automatically created with:
- Email: `{first_name}.{last_name}@kavyatransports.com` (lowercased)
- Auto-generated password
- Role: `driver`
- Response includes `login_email` and `login_password` for the created user

---

## 8. Permission System

Permissions follow the format `{module}:{action}`. The middleware enforces these on every API request.

### Role → Permission Mapping

**Admin** — Full access (wildcard `*`)

**Manager:**
```
client:create, client:read, client:update, client:delete
job:create, job:read, job:update, job:delete, job:approve
lr:create, lr:read, lr:update, lr:delete
eway:create, eway:read, eway:update, eway:delete
trip:create, trip:read, trip:update, trip:delete
vehicle:create, vehicle:read, vehicle:update, vehicle:delete
driver:create, driver:read, driver:update, driver:delete
invoice:create, invoice:read, invoice:update, invoice:delete, invoice:approve
payment:create, payment:read, payment:update, payment:delete
ledger:read, ledger:export
fuel:create, fuel:read, fuel:approve
maintenance:create, maintenance:read, maintenance:approve
expense:create, expense:read, expense:approve
report:view, report:export
tracking:view, tracking:live
alert:view, alert:manage
document:create, document:read, document:update, document:delete, document:approve
user:create, user:read, user:update
```

**Fleet Manager:**
```
trip:create, trip:read, trip:update, trip:start, trip:complete
eway:read
vehicle:read, vehicle:update
driver:read, driver:update
lr:read
fuel:create, fuel:read, fuel:approve
maintenance:create, maintenance:read, maintenance:approve
expense:create, expense:read, expense:approve
tracking:view, tracking:live
alert:view, alert:manage
report:view
document:create, document:read, document:update
```

**Accountant:**
```
invoice:create, invoice:read, invoice:update, invoice:delete
payment:create, payment:read, payment:update
ledger:read, ledger:export
client:read
trip:read
report:view, report:export
expense:create, expense:read, expense:approve
fuel:read
maintenance:read
alert:view
```

**Project Associate:**
```
lr:create, lr:read, lr:update
eway:create, eway:read, eway:update
trip:create, trip:read, trip:update
job:create, job:read, job:update
client:read
vehicle:read
driver:read
document:create, document:read, document:update
alert:view
```

**Driver:**
```
trip:read, trip:start, trip:complete
expense:create, expense:read
fuel:create, fuel:read
lr:read
document:read
alert:view
```

---

## 9. Backend API Reference

All endpoints are prefixed with `/api/v1`. Total: **150+ endpoints** across 30 files.

### Auth (`/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login, returns JWT tokens + permissions |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user profile |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/logout` | Logout |

### Users (`/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users (paginated) |
| GET | `/users/{id}` | Get user details |
| POST | `/users` | Create new user/employee |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Deactivate user (soft delete) |

### Admin (`/admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/health` | System health check (PostgreSQL, MongoDB, Redis, Celery) |

### Clients (`/clients`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/clients` | List clients (paginated, searchable) |
| GET | `/clients/{id}` | Get client with contacts |
| POST | `/clients` | Create client |
| PUT | `/clients/{id}` | Update client |
| DELETE | `/clients/{id}` | Soft-delete client |
| GET | `/clients/{id}/contacts` | List client contacts |
| POST | `/clients/{id}/contacts` | Add contact |
| DELETE | `/clients/contacts/{id}` | Remove contact |

### Vehicles (`/vehicles`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/vehicles` | List vehicles with expiry alerts |
| GET | `/vehicles/summary` | Fleet summary stats |
| GET | `/vehicles/expiring` | Vehicles with expiring documents |
| GET | `/vehicles/{id}` | Get vehicle details |
| POST | `/vehicles` | Create vehicle |
| PUT | `/vehicles/{id}` | Update vehicle |
| DELETE | `/vehicles/{id}` | Soft-delete vehicle |

### Drivers (`/drivers`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/drivers/dashboard` | Driver module stats |
| GET | `/drivers` | List drivers |
| GET | `/drivers/{id}` | Get driver with licenses |
| POST | `/drivers` | Create driver (auto-creates user login) |
| PUT | `/drivers/{id}` | Update driver |
| DELETE | `/drivers/{id}` | Soft-delete driver |
| GET | `/drivers/{id}/licenses` | List driver licenses |
| POST | `/drivers/{id}/licenses` | Add license |
| GET | `/drivers/{id}/trips` | Get driver's trips |
| GET | `/drivers/{id}/behaviour` | Driver behaviour analytics |

### Jobs (`/jobs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs` | List jobs (filterable by status/client) |
| GET | `/jobs/{id}` | Get job with client name |
| POST | `/jobs` | Create job |
| PUT | `/jobs/{id}` | Update job |
| DELETE | `/jobs/{id}` | Soft-delete job |
| POST | `/jobs/{id}/submit-for-approval` | Submit draft for approval |
| POST | `/jobs/{id}/status` | Change job status |
| PUT | `/jobs/{id}/assign` | Assign job (auto-approve) |
| GET | `/jobs/lookup/clients` | Client lookup for job form |
| GET | `/jobs/lookup/routes` | Route lookup for job form |
| GET | `/jobs/lookup/vehicle-types` | Vehicle type options |

### LR — Lorry Receipts (`/lr`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/lr` | List LRs (filterable by job/trip) |
| GET | `/lr/{id}` | Get LR details |
| POST | `/lr` | Create LR |
| PUT | `/lr/{id}` | Update LR |
| DELETE | `/lr/{id}` | Soft-delete LR |
| POST | `/lr/{id}/status` | Change LR status (with POD tracking) |

### E-way Bills (`/eway-bills`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/eway-bills` | List e-way bills |
| GET | `/eway-bills/{id}` | Get e-way bill details |
| POST | `/eway-bills` | Create e-way bill |
| PUT | `/eway-bills/{id}` | Update e-way bill |
| POST | `/eway-bills/api/generate` | Generate via government portal |
| POST | `/eway-bills/api/cancel` | Cancel via portal |
| POST | `/eway-bills/api/extend` | Extend validity |
| GET | `/eway-bills/api/details/{ewb}` | Fetch from portal |

### Trips (`/trips`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/trips` | List trips (paginated, filterable) |
| GET | `/trips/{id}` | Get trip with full details |
| POST | `/trips` | Create trip |
| PUT | `/trips/{id}` | Update trip |
| DELETE | `/trips/{id}` | Soft-delete trip |
| POST | `/trips/{id}/status` | Change trip status |
| PUT | `/trips/{id}/start` | Start trip (set odometer) |
| PUT | `/trips/{id}/reach` | Mark reached destination |
| PUT | `/trips/{id}/close` | Close/complete trip |
| GET | `/trips/{id}/expenses` | List trip expenses |
| POST | `/trips/{id}/expenses` | Add expense |
| POST | `/trips/expenses/{id}/verify` | Verify expense |
| GET | `/trips/{id}/fuel` | List fuel entries |
| POST | `/trips/{id}/fuel` | Add fuel entry |
| GET | `/trips/next-trip-number` | Generate next trip number |
| GET | `/trips/lookup/jobs` | Job lookup |
| GET | `/trips/lookup/vehicles` | Vehicle lookup |
| GET | `/trips/lookup/drivers` | Driver lookup |
| GET | `/trips/lookup/routes` | Route lookup |
| GET | `/trips/lookup/lrs` | LR lookup |

### Finance (`/finance`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/finance/invoices` | List invoices |
| GET | `/finance/invoices/{id}` | Get invoice details |
| POST | `/finance/invoices` | Create invoice |
| PUT | `/finance/invoices/{id}` | Update invoice |
| DELETE | `/finance/invoices/{id}` | Soft-delete invoice |
| GET | `/finance/payments` | List payments |
| POST | `/finance/payments` | Record payment |
| GET | `/finance/ledger` | List ledger entries |
| POST | `/finance/ledger` | Create ledger entry |
| GET | `/finance/vendors` | List vendors |
| POST | `/finance/vendors` | Create vendor |
| GET | `/finance/bank-accounts` | List bank accounts |
| POST | `/finance/bank-accounts` | Create bank account |
| GET | `/finance/bank-transactions` | List bank transactions |
| POST | `/finance/bank-transactions` | Record bank transaction |
| GET | `/finance/routes` | List routes |
| GET | `/finance/routes/{id}` | Get route details |
| POST | `/finance/routes` | Create route |
| PUT | `/finance/routes/{id}` | Update route |

### Dashboard (`/dashboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Main dashboard stats |
| GET | `/dashboard/overview` | Dashboard overview |
| GET | `/dashboard/fleet-stats` | Fleet statistics |
| GET | `/dashboard/trip-stats` | Trip status distribution |
| GET | `/dashboard/finance-stats` | Finance KPIs |
| GET | `/dashboard/notifications` | User notifications |
| POST | `/dashboard/notifications/{id}/read` | Mark notification read |
| GET | `/dashboard/charts/revenue-trend` | Revenue trend chart |
| GET | `/dashboard/charts/expense-breakdown` | Expense breakdown chart |
| GET | `/dashboard/charts/fleet-utilization` | Fleet utilization chart |
| GET | `/dashboard/revenue-chart` | Revenue chart (legacy) |
| GET | `/dashboard/trip-status` | Trip status (legacy) |
| GET | `/dashboard/top-clients` | Top clients by revenue |
| GET | `/dashboard/expense-breakdown` | Expense breakdown (legacy) |
| GET | `/dashboard/pa/kpis` | PA dashboard KPIs |
| GET | `/dashboard/pa/action-center` | PA pending tasks |
| GET | `/dashboard/pa/job-pipeline` | PA job pipeline |
| GET | `/dashboard/pa/recent-activity` | PA recent activity |
| GET | `/dashboard/pa/banking-status` | PA banking status |
| GET | `/dashboard/pa/fleet-status` | PA fleet status |
| GET | `/dashboard/pa/compliance-alerts` | PA compliance alerts |
| GET | `/dashboard/pa/trip-workflow` | PA trip workflow |

### Documents (`/documents`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents` | List documents (searchable) |
| GET | `/documents/lookup/entities` | Entity lookup for linking |
| GET | `/documents/lookup/compliance-categories` | Compliance categories |
| GET | `/documents/{id}` | Get document details |
| POST | `/documents/upload` | Upload document file |
| DELETE | `/documents/{id}` | Soft-delete document |

### Tracking (`/tracking`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tracking/live` | Live tracked trips/vehicles |
| GET | `/tracking/active-trips` | Active trips list |
| GET | `/tracking/trip/{id}` | Trip tracking data |
| GET | `/tracking/vehicle/{id}` | Vehicle tracking data |
| GET | `/tracking/alerts` | Tracking alerts |
| POST | `/tracking/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/tracking/gps/positions` | Live GPS positions (MongoDB) |
| GET | `/tracking/gps/path/{vehicle_id}` | Vehicle GPS path/trail |

### Reports (`/reports`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/dashboard` | Role-aware report dashboard |
| GET | `/reports/revenue-chart` | Revenue chart data |
| GET | `/reports/trip-status` | Trip status distribution |
| GET | `/reports/top-clients` | Top clients by revenue |
| GET | `/reports/expense-breakdown` | Expense breakdown |
| GET | `/reports/trip-summary` | Trip summary (date-filtered) |
| GET | `/reports/vehicle-performance` | Vehicle performance |

### Service / Maintenance (`/service`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/service` | List service/maintenance records |
| POST | `/service` | Create service record |
| PUT | `/service/{id}` | Update service record |
| DELETE | `/service/{id}` | Delete service record |

### Tyres (`/tyres`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tyres` | List tyres with vehicle info |
| POST | `/tyres` | Create tyre record |
| PUT | `/tyres/{id}` | Update tyre |
| DELETE | `/tyres/{id}` | Soft-delete tyre |
| POST | `/tyres/{id}/event` | Log tyre event (remove/scrap/retread) |

### Accountant (`/accountant`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/accountant/dashboard` | Accountant dashboard stats |
| GET | `/accountant/invoices` | Accountant invoices view |
| GET | `/accountant/payments` | Accountant payments view |
| GET | `/accountant/ledger` | Accountant ledger view |
| GET | `/accountant/receivables` | Client receivables summary |
| GET | `/accountant/expenses` | Expenses (filterable by verified) |
| GET | `/accountant/banking` | Bank accounts overview |

### Fleet Manager (`/fleet-manager`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/fleet-manager/dashboard` | Fleet manager dashboard |
| GET | `/fleet-manager/vehicles` | Fleet vehicles with alerts |
| GET | `/fleet-manager/trips` | Fleet trips view |
| GET | `/fleet-manager/expiring-documents` | Expiring vehicle documents |

### Notifications (`/notifications`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/notifications/push` | Send FCM push notification |
| POST | `/notifications/push/topic` | Send push to FCM topic |
| POST | `/notifications/sms` | Send SMS via MSG91 |
| POST | `/notifications/whatsapp` | Send WhatsApp via Gupshup |
| POST | `/notifications/whatsapp/template` | Send WhatsApp template |

### Payments Gateway (`/payments`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/payments/create-link` | Create Razorpay payment link |
| POST | `/payments/verify` | Verify Razorpay signature |
| GET | `/payments/status/{id}` | Get payment status |

### Maps (`/maps`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/maps/route` | Calculate route distance/duration |
| GET | `/maps/geocode` | Geocode address |
| GET | `/maps/reverse-geocode` | Reverse geocode lat/lng |

### Government API Integrations

**VAHAN — Vehicle Verification (`/vahan`)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/vahan/rc/{reg}` | RC details lookup |
| GET | `/vahan/insurance/{reg}` | Insurance status |
| GET | `/vahan/fitness/{reg}` | Fitness certificate |
| GET | `/vahan/permit/{reg}` | Permit status |
| GET | `/vahan/puc/{reg}` | PUC status |
| GET | `/vahan/full-check/{reg}` | Full compliance check |

**Sarathi — DL Verification (`/sarathi`)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sarathi/verify/{dl}` | Verify driving licence |
| GET | `/sarathi/details/{dl}` | Full DL details |

**eChallan (`/echallan`)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/echallan/vehicle/{reg}` | Challans by vehicle |
| GET | `/echallan/driver/{dl}` | Challans by DL number |
| GET | `/echallan/status/{id}` | Challan payment status |

**GST (`/gst`)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gst/verify/{gstin}` | Verify GSTIN |

**Fuel Prices (`/fuel`)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/fuel` | Fuel price for a city |
| GET | `/fuel/bulk` | Fuel prices for all major cities |

### Aliases (`/aliases`) — Frontend convenience endpoints
| Method | Path | Backend Source |
|--------|------|---------------|
| GET | `/aliases/routes` | Routes listing |
| GET | `/aliases/ewb` | E-way bills listing |
| GET | `/aliases/expenses` | Trip expenses listing |
| GET | `/aliases/fuel` | Fuel entries listing |
| GET | `/aliases/attendance` | Driver attendance listing |
| GET | `/aliases/checklists` | Driver checklists (MongoDB) |
| GET | `/aliases/invoices` | Invoices listing |
| GET | `/aliases/banking` | Bank transactions listing |
| GET | `/aliases/ledger` | Ledger entries listing |
| GET | `/aliases/service` | Service/maintenance records |

### Compatibility (`/compat`) — Frontend route compatibility
| Method | Path | Description |
|--------|------|-------------|
| GET | `/compat/finance/receivables` | Client receivables |
| GET | `/compat/finance/payables` | Vendor payables |
| GET | `/compat/finance/banking/*` | Banking accounts/entries |
| GET | `/compat/fleet/dashboard/*` | Fleet KPIs, charts, alerts |
| GET | `/compat/fleet/drivers` | Fleet drivers |
| GET | `/compat/fleet/tracking/live` | Live fleet tracking |
| GET | `/compat/fleet/maintenance/schedule` | Maintenance schedule |
| GET | `/compat/fleet/fuel/records` | Fuel records |

---

## 10. Backend Models

### PostgreSQL — 45 Tables

| Model | Table | Key Fields |
|-------|-------|------------|
| **User** | `users` | id, email, phone, password_hash, first_name, last_name, is_active, branch_id, tenant_id |
| **Role** | `roles` | id, name, display_name, role_type (ADMIN/MANAGER/FLEET_MANAGER/ACCOUNTANT/PROJECT_ASSOCIATE/DRIVER) |
| **Permission** | `permissions` | id, module, action, resource |
| **UserRole** | `user_role_assignments` | user_id, role_id, assigned_by, valid_from, valid_until |
| **Branch** | `branches` | id, name, code, address, city, state, tenant_id |
| **Tenant** | `tenants` | id, name, slug, domain, subscription_plan, is_active |
| **Client** | `clients` | id, name, code, client_type, gstin, credit_limit, credit_days, outstanding_amount |
| **ClientContact** | `client_contacts` | id, client_id, name, designation, email, phone, is_primary |
| **ClientAddress** | `client_addresses` | id, client_id, address_type, city, state, latitude, longitude |
| **Vehicle** | `vehicles` | id, registration_number, vehicle_type, make, model, capacity_tons, status, ownership_type, odometer_reading, fitness/permit/insurance/puc_valid_until |
| **VehicleDocument** | `vehicle_documents` | id, vehicle_id, document_type, document_number, expiry_date, file_url |
| **VehicleMaintenance** | `vehicle_maintenance` | id, vehicle_id, maintenance_type, service_type, service_date, total_cost, next_service_date |
| **VehicleTyre** | `vehicle_tyres` | id, vehicle_id, tyre_number, position, brand, size, purchase_cost, current_km, condition |
| **Driver** | `drivers` | id, employee_code, first_name, last_name, phone, status, salary_type, base_salary, per_km_rate, user_id |
| **DriverLicense** | `driver_licenses` | id, driver_id, license_number, license_type (LMV/HMV/HGMV/TRANSPORT), expiry_date |
| **DriverDocument** | `driver_documents` | id, driver_id, document_type, file_url, is_verified |
| **DriverAttendance** | `driver_attendance` | id, driver_id, date, status, check_in_time, check_out_time |
| **Job** | `jobs` | id, job_number, job_date, client_id, origin_city, destination_city, material_type, status, total_amount, route_id |
| **JobStatus** | `job_status_history` | id, job_id, from_status, to_status, changed_by, remarks |
| **LR** | `lrs` | id, lr_number, lr_date, job_id, consignor_name, consignee_name, origin, destination, eway_bill_number, freight_amount, status, trip_id |
| **LRItem** | `lr_items` | id, lr_id, description, packages, quantity, actual_weight, amount |
| **LRDocument** | `lr_documents` | id, lr_id, document_type, file_url |
| **Trip** | `trips` | id, trip_number, trip_date, job_id, vehicle_id, driver_id, origin, destination, status, start/end_odometer, total_expense, revenue, profit_loss |
| **TripExpense** | `trip_expenses` | id, trip_id, category (FUEL/TOLL/FOOD/PARKING/etc.), amount, payment_mode, is_verified |
| **TripFuelEntry** | `trip_fuel_entries` | id, trip_id, vehicle_id, quantity_litres, rate_per_litre, total_amount, pump_name |
| **TripStatus** | `trip_status_history` | id, trip_id, from_status, to_status, latitude, longitude, location_name |
| **Route** | `routes` | id, route_code, route_name, origin_city, destination_city, distance_km, estimated_hours, toll_gates |
| **RouteBudget** | `route_budgets` | id, route_id, vehicle_type, fuel_cost, toll_cost, total_budget |
| **RateChart** | `rate_charts` | id, client_id, route_id, rate_per_trip, rate_per_ton |
| **Invoice** | `invoices` | id, invoice_number, invoice_date, client_id, subtotal, cgst/sgst/igst_amount, total_amount, amount_paid, amount_due, status |
| **InvoiceItem** | `invoice_items` | id, invoice_id, description, trip_id, lr_id, rate, amount, tax_rate |
| **Payment** | `payments` | id, payment_number, payment_date, payment_type, invoice_id, client_id, amount, payment_method |
| **EwayBill** | `eway_bills` | id, eway_bill_number, job_id, lr_id, supplier/recipient info, vehicle_number, distance_km, total_invoice_value, valid_from/until, status |
| **EwayItem** | `eway_items` | id, eway_bill_id, product_name, hsn_code, quantity, taxable_value, GST amounts |
| **Document** | `documents` | id, doc_number, title, document_type, entity_type, entity_id, expiry_date, file_url, approval_status |
| **DocumentVersion** | `document_versions` | id, document_id, version, file_url |
| **Vendor** | `vendors` | id, name, code, vendor_type |
| **BankAccount** | `bank_accounts` | id, account_name, account_number, bank_name, current_balance |
| **BankTransaction** | `bank_transactions` | id, account_id, transaction_type, amount, description |
| **LedgerEntry** | `ledger_entries` | id, entry_number, ledger_type, amount, client_id |

Association tables: `user_roles`, `role_permissions`

### MongoDB — 11 Collections

| Collection | Purpose |
|-----------|---------|
| `trip_tracking` | GPS tracking trails with speed, distance, driving alerts |
| `vehicle_telemetry` | Real-time vehicle sensor data (30-day TTL) |
| `fuel_sensor_logs` | Fuel level sensor readings (90-day TTL) |
| `audit_logs` | Immutable audit trail for all system actions |
| `notification_logs` | Notification delivery history |
| `alert_logs` | System alerts and acknowledgement tracking |
| `analytics_snapshots` | Pre-computed dashboard analytics |
| `document_upload_logs` | Document upload attempts and outcomes |
| `document_activity_logs` | Document workflow activity |
| `driver_checklist_logs` | Pre-trip vehicle checklist submissions |

---

## 11. Backend Services

25 service files in `backend/app/services/`:

| Service | Purpose |
|---------|---------|
| `auth_service.py` | User authentication, token management, password hashing |
| `cache_service.py` | Redis caching utility |
| `client_service.py` | Client CRUD and contact management |
| `dashboard_service.py` | Dashboard stats, charts, KPIs for all roles |
| `driver_service.py` | Driver CRUD, license, attendance, behaviour analytics |
| `echallan_service.py` | eChallan (traffic fines) lookup via government API |
| `eway_bill_api_service.py` | Government E-way Bill API integration |
| `eway_service.py` | E-way bill CRUD in local database |
| `fcm_service.py` | Firebase Cloud Messaging push notifications |
| `finance_service.py` | Invoice, payment, ledger, vendor, banking CRUD |
| `fuel_price_service.py` | Real-time fuel prices by city |
| `gst_verify_service.py` | GSTIN verification via government API |
| `job_service.py` | Job CRUD and status workflow |
| `lr_service.py` | LR (Lorry Receipt) CRUD and status workflow |
| `maps_service.py` | Google Maps route calculation, geocoding |
| `razorpay_service.py` | Razorpay payment link creation and verification |
| `s3_service.py` | File upload to S3/MinIO/local storage |
| `sarathi_service.py` | Driving licence verification via Sarathi API |
| `sms_service.py` | SMS sending via MSG91 |
| `tracking_service.py` | GPS live positions and vehicle path from MongoDB |
| `trip_service.py` | Trip CRUD, status transitions, expense/fuel management |
| `user_service.py` | User CRUD and role management |
| `vahan_service.py` | Vehicle RC/insurance/fitness/permit/PUC check via VAHAN |
| `vehicle_service.py` | Vehicle CRUD, fleet summary, expiry alerts |
| `whatsapp_service.py` | WhatsApp messaging via Gupshup API |

---

## 12. Frontend (React)

### Routes (65+ in App.tsx)

```
/login                              LoginPage
/dashboard                          DashboardPage

# Clients
/clients                            ClientsPage
/clients/:id                        ClientDetailPage

# Vehicles
/vehicles                           VehiclesPage
/vehicles/:id                       VehicleDetailPage

# Drivers
/drivers                            DriversPage
/drivers/dashboard                  DriverDashboardPage
/drivers/:id                        DriverDetailPage

# Driver Portal
/driver/trips                       DriverTripsPage
/driver/attendance                  DriverAttendancePage
/driver/expenses                    DriverExpensesPage
/driver/documents                   DriverDocumentsPage

# Jobs
/jobs                               JobsPage
/jobs/new                           CreateJobPage
/jobs/:id/edit                      CreateJobPage
/jobs/:id                           JobDetailPage

# Lorry Receipts
/lr                                 LRListPage
/lr/new                             CreateLRPage
/lr/:id/edit                        CreateLRPage
/lr/:id                             LRDetailPage

# E-way Bills
/lr/eway-bill                       EwayBillListPage
/lr/eway-bill/new                   GenerateEwayBillPage
/lr/eway-bill/:id/edit              GenerateEwayBillPage
/lr/eway-bill/:id                   EwayBillDetailPage

# Trips
/trips                              TripsPage
/trips/new                          CreateTripPage
/trips/:id/edit                     CreateTripPage
/trips/:id                          TripDetailPage
/trips/route-calculator             RouteCalculatorPage

# Documents
/documents                          DocumentListPage
/documents/upload                   UploadDocumentPage
/documents/:id/edit                 UploadDocumentPage
/documents/new-upload               DocumentUploadPage

# Finance
/finance/invoices                   InvoicesPage
/finance/payments                   PaymentsPage
/finance/ledger                     LedgerPage
/finance/receivables                ReceivablesPage
/finance/payables                   PayablesPage
/finance/banking/new                BankingEntryPage
/finance/payment-link               PaymentLinkPage

# Tracking
/tracking                           LiveTrackingPage
/tracking/gps                       GPSLiveMapPage
/tracking/replay                    TripReplayPage
/alerts                             FleetAlertsPage

# Reports
/reports                            ReportsPage

# Settings
/settings                           SettingsPage
/settings/notifications             NotificationCenterPage

# Fleet Management
/fleet/dashboard                    FleetDashboardPage
/fleet                              FleetDashboardPage
/fleet/vehicles                     FleetVehiclesPage
/fleet/vehicles/:id                 FleetVehiclesPage
/fleet/drivers                      FleetDriversPage
/fleet/drivers/:id                  FleetDriversPage
/fleet/tracking                     FleetTrackingPage
/fleet/maintenance                  FleetMaintenancePage
/fleet/fuel                         FleetFuelPage
/fleet/tyres                        TyrePage
/fleet/alerts                       FleetAlertsPage
/fleet/reports                      FleetReportsPage
/fleet/vehicle-compliance           VehicleCompliancePage
/fleet/driver-compliance            DriverCompliancePage
/fleet/gst-verify                   GSTVerificationPage
/fleet/fuel-prices                  FuelPricePage

# Routes
/routes                             RoutesPage

# Accountant
/accountant/dashboard               AccountantDashboardPage
/accountant                         AccountantDashboardPage
/accountant/invoices                AccountantInvoicesPage
/accountant/receivables             AccountantReceivablesPage
/accountant/payables                AccountantPayablesPage
/accountant/expenses                AccountantExpensesPage
/accountant/fuel                    AccountantFuelExpensePage
/accountant/banking                 AccountantBankingPage
/accountant/ledger                  AccountantLedgerPage
/accountant/reports                 AccountantReportsPage
```

### Pages (73 .tsx files)

| Category | Pages |
|----------|-------|
| **Auth** | LoginPage |
| **Dashboard** | DashboardPage, ProjectAssociateDashboard |
| **Jobs** | JobsPage, JobDetailPage, CreateJobPage |
| **LR** | LRListPage, LRDetailPage, CreateLRPage |
| **Trips** | TripsPage, TripDetailPage, CreateTripPage, RouteCalculatorPage |
| **Clients** | ClientsPage, ClientDetailPage |
| **Vehicles** | VehiclesPage, VehicleDetailPage |
| **Drivers** | DriversPage, DriverDetailPage, DriverDashboardPage |
| **Driver Portal** | DriverTripsPage, DriverExpensesPage, DriverDocumentsPage, DriverAttendancePage |
| **Fleet** | FleetDashboardPage, FleetVehiclesPage, FleetDriversPage, FleetMaintenancePage, FleetFuelPage, FleetTrackingPage, FleetAlertsPage, FleetReportsPage, ServicePage, TyrePage, FuelPage, FuelPricePage, VehicleCompliancePage, DriverCompliancePage, GSTVerificationPage |
| **Finance** | InvoicesPage, PaymentsPage, LedgerPage, ReceivablesPage, PayablesPage, BankingEntryPage, PaymentLinkPage |
| **Accountant** | AccountantDashboardPage, AccountantInvoicesPage, AccountantReceivablesPage, AccountantPayablesPage, AccountantExpensesPage, AccountantFuelExpensePage, AccountantLedgerPage, AccountantBankingPage, AccountantReportsPage |
| **E-way Bill** | EwayBillListPage, EwayBillDetailPage, GenerateEwayBillPage |
| **Tracking** | LiveTrackingPage, GPSLiveMapPage, TripReplayPage |
| **Documents** | DocumentListPage, UploadDocumentPage, DocumentUploadPage |
| **Reports** | ReportsPage |
| **Admin** | EmployeesPage, AttendancePage, ConnectivityPage |
| **Masters** | RoutesPage |
| **Settings** | SettingsPage, NotificationCenterPage |
| **Common** | NotFoundPage, UnauthorizedPage |

### Frontend Services
| File | Purpose |
|------|---------|
| `api.ts` | Axios instance with JWT interceptor and auto-refresh |
| `authService.ts` | Login, logout, token management, password change |
| `dataService.ts` | ~1200 lines — all CRUD operations for every entity |
| `websocketService.ts` | WebSocket connection with auto-reconnect |
| `workflowService.ts` | Job/LR/Trip workflow state management |
| `useRealtimeDashboard.ts` | Real-time dashboard data hook |

### State Management (Zustand)
| Store | Purpose |
|-------|---------|
| `authStore` | User session, tokens, permissions, login/logout |
| `appStore` | Global app state, sidebar, notifications |

---

## 13. Flutter Driver App

**86 Dart files** in `flutter_driver_app/lib/` with **4 role-based navigation shells**.

### Configuration
- **API Base URL:** `http://10.0.2.2:8000/api/v1` (Android emulator → host machine)
- **WebSocket URL:** `ws://10.0.2.2:8000/ws`
- **Timeouts:** 15s connect/receive/send
- **State Management:** Riverpod
- **Routing:** GoRouter with auth redirect
- **Offline Queue:** Hive (stores pending actions when offline)
- **Theme:** Custom light + dark themes

### Driver Screens (Core)
| Route | Screen | Description |
|-------|--------|-------------|
| `/login` | LoginScreen | Login for all roles |
| `/today` | TodayScreen | Today's tasks and summary |
| `/trips` | TripListScreen | Assigned trips list |
| `/trips/:id` | TripDetailScreen | Trip details, status updates, map |
| `/expenses` | ExpenseListScreen | Expense list |
| `/expenses/add` | AddExpenseScreen | Add trip expense |
| `/profile` | ProfileScreen | User profile and settings |
| `/checklist` | ChecklistScreen | Pre-trip vehicle checklist |
| `/documents` | DocumentsScreen | Driver documents |
| `/notifications` | NotificationsScreen | Notification list |

### Fleet Manager Shell (7 screens)
| Screen | Description |
|--------|-------------|
| FleetHomeScreen | Fleet manager dashboard |
| FleetVehicleListScreen | Vehicle fleet list |
| FleetVehicleDetailScreen | Vehicle details |
| FleetLiveMapScreen | Live GPS map |
| FleetExpenseApprovalScreen | Approve driver expenses |
| FleetServiceLogScreen | Service/maintenance logs |
| FleetTyreEventScreen | Tyre events management |

### Accountant Shell (6 screens)
| Screen | Description |
|--------|-------------|
| AccountantHomeScreen | Accountant dashboard |
| AccountantInvoicesScreen | Invoice management |
| AccountantInvoiceDetailScreen | Invoice details |
| AccountantPaymentsScreen | Payment tracking |
| AccountantReceivablesScreen | Client receivables |
| AccountantExpenseApprovalScreen | Expense approval |

### Project Associate Shell (6 screens)
| Screen | Description |
|--------|-------------|
| AssociateHomeScreen | Associate dashboard |
| AssociateJobListScreen | Job listing |
| AssociateLRCreateScreen | Create LR |
| AssociateEWBCreateScreen | Create E-way Bill |
| AssociateTripCloseScreen | Close trips |
| AssociateDocUploadScreen | Upload documents |

### App Services
| Service | Purpose |
|---------|---------|
| `api_service.dart` | HTTP client with JWT auth |
| `auth_service.dart` | Login, token storage, logout |
| `location_service.dart` | GPS location tracking |
| `notification_service.dart` | FCM push notifications |
| `offline_queue_service.dart` | Hive-based offline action queue |
| `sync_service.dart` | Background data sync |

---

## 14. Seed Data

Run `python seed_data.py` in the `backend/` directory. This creates:

| Entity | Count | Details |
|--------|-------|---------|
| **Roles** | 6 | admin, manager, fleet_manager, accountant, project_associate, driver |
| **Admin User** | 1 | `admin@kavyatransports.com` / `admin123` |
| **Demo Users** | 5 | manager, fleet, accountant, pa, driver `@kavyatransports.com` / `demo123` |
| **Clients** | 6 | TN Cements, Sakthi Sugars, Chettinad Cement, Rane Holdings, Bangalore Steel, Kerala Chemicals (GSTINs, credit limits ₹10L–₹50L) |
| **Vehicles** | 8 | TN-registered: TATA Prima, Ashok Leyland Captain, Bharat Benz, Eicher, Mahindra Bolero (trucks, trailers, tanker, container, LCV; 1.5–35 tons) |
| **Drivers** | 6 | TN-based: Ramesh, Suresh, Mahesh, Arjun, Vijay, Prakash (salaries ₹30K–₹38K/month, HMV licenses) |
| **Routes** | 8 | CHN-CBE (505km), CHN-MDU (462km), CHN-BLR (346km), CHN-KOC (690km), CBE-BLR (365km), CHN-TIR (332km), MDU-TUT (138km), CHN-HYD (625km) |
| **Bank Accounts** | 2 | Indian Bank (Current, ₹7.5L) and Indian Overseas Bank (Savings, ₹3.5L) |
| **Vendors** | 3 | Indian Oil (fuel), MRF Tyres (tyre), TVS Auto Service (maintenance) |
| **Jobs** | 28 | 20 completed, 5 active (in_progress), 3 pending (2 draft, 1 pending_approval) |
| **LRs** | 25 | One per completed/active job (20 POD_RECEIVED, 5 IN_TRANSIT) |
| **Trips** | 25 | One per completed/active job (20 COMPLETED, 5 active) |
| **Invoices** | 10 | For first 10 completed jobs (7 PAID, 3 PENDING; GST with CGST/SGST/IGST) |

---

## 15. Tests

### Backend Tests (`backend/tests/`)

| Test File | What It Tests |
|-----------|---------------|
| `conftest.py` | Shared fixtures: async DB session, test client, auth tokens |
| `test_auth.py` | Login, token refresh, profile, password change, logout |
| `test_clients.py` | Client CRUD, contacts, search, status filters |
| `test_vehicles.py` | Vehicle CRUD, fleet summary, expiry alerts |
| `test_drivers.py` | Driver CRUD, license management, trips, behaviour |
| `test_jobs.py` | Job CRUD, status workflow, approval, assignment |
| `test_lr.py` | LR CRUD, status changes, POD tracking |
| `test_trips.py` | Trip CRUD, status transitions, expenses, fuel entries |
| `test_finance.py` | Invoices, payments, ledger, vendors, bank accounts |
| `test_business_logic.py` | Cross-entity business rules and workflow validation |
| `test_data_flow.py` | End-to-end: job → LR → trip → invoice pipeline |
| `test_full_connectivity.py` | Full system connectivity across all endpoints |

### Running Tests
```bash
cd backend
pytest                              # Run all tests
pytest tests/test_auth.py           # Run specific test file
pytest -v                           # Verbose output
pytest --tb=short                   # Short tracebacks
```

---

## 16. External Integrations

| Integration | Service File | Purpose | API Key Env Var |
|-------------|-------------|---------|----------------|
| **VAHAN** | `vahan_service.py` | Vehicle RC, insurance, fitness, permit, PUC verification | `VAHAN_API_KEY` |
| **Sarathi** | `sarathi_service.py` | Driving licence verification | `SARATHI_API_KEY` |
| **eChallan** | `echallan_service.py` | Traffic challan/fine lookup | `ECHALLAN_API_KEY` |
| **E-way Bill** | `eway_bill_api_service.py` | Government E-way Bill portal (generate/cancel/extend) | `EWAY_BILL_USERNAME`, `EWAY_BILL_PASSWORD`, `EWAY_BILL_GSTIN` |
| **GST** | `gst_verify_service.py` | GSTIN verification | `GST_VERIFY_API_KEY` |
| **Google Maps** | `maps_service.py` | Route calculation, geocoding, reverse geocoding | `GOOGLE_MAPS_API_KEY` |
| **Firebase FCM** | `fcm_service.py` | Push notifications to mobile devices | `FIREBASE_CREDENTIALS_PATH` |
| **MSG91** | `sms_service.py` | SMS notifications | `MSG91_API_KEY` |
| **Gupshup** | `whatsapp_service.py` | WhatsApp messaging | `WHATSAPP_API_KEY` |
| **Razorpay** | `razorpay_service.py` | Payment link creation and verification | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| **AWS S3 / MinIO** | `s3_service.py` | File/document storage | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

> **Note:** External APIs require valid API keys to function. Without keys, they return placeholder/mock responses. The system works fully without them for core operations.

---

## 17. WebSocket

### Endpoint
`ws://localhost:8000/ws` (proxied via Vite in development)

### Frontend Service
`websocketService.ts` handles:
- Auto-connect on login
- Auto-reconnect on disconnect (exponential backoff)
- Real-time notifications and dashboard updates
- Connection uses `window.location.host` for the WebSocket URL

### Backend Handler
Defined in `app/main.py` at `/ws` path.

---

## 18. Known Issues & Limitations

### Working
- ✅ All 6 role logins and dashboards
- ✅ Complete CRUD for all entities (clients, vehicles, drivers, jobs, LR, trips, invoices, etc.)
- ✅ Job workflow: Draft → Pending Approval → Approved → In Progress → Completed
- ✅ LR workflow: Draft → Generated → In Transit → Delivered → POD Received
- ✅ Trip workflow: Planned → Started → In Transit → Completed
- ✅ Finance: Invoicing, payments, ledger, receivables, payables, banking
- ✅ Fleet: Dashboard, vehicles, drivers, maintenance, fuel, tyres, alerts, tracking
- ✅ Accountant: Dashboard, invoices, receivables, payables, expenses, fuel, banking, ledger, reports
- ✅ Driver portal: Trips, attendance, expenses, documents
- ✅ Employee/user creation from admin pages
- ✅ Driver auto-creates user account on creation
- ✅ Permission enforcement on all endpoints
- ✅ WebSocket connection
- ✅ 0 TypeScript errors, frontend builds successfully

### Limitations / Not Yet Connected
- External government APIs (VAHAN, Sarathi, eChallan, E-way Bill) require real API keys — currently return mock/placeholder data
- GPS live tracking requires GPS device integration or mobile app sending location data
- Celery background tasks are configured but not actively running background jobs
- File upload stores locally by default (S3/MinIO needs configuration)
- Email notifications (SMTP) not configured
- Payment gateway (Razorpay) needs live API keys for real payments
- Flutter app tested on Android emulator — production deployment needs signing and store configuration

---

## 19. Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@kavyatransports.com | admin123 |
| **Manager** | manager@kavyatransports.com | demo123 |
| **Fleet Manager** | fleet@kavyatransports.com | demo123 |
| **Accountant** | accountant@kavyatransports.com | demo123 |
| **Project Associate** | pa@kavyatransports.com | demo123 |
| **Driver** | driver@kavyatransports.com | demo123 |

> **Note:** These are set by `seed_data.py`. The admin password is `admin123`; all other demo users use `demo123`.

---

## 20. Demo Walkthrough

### Quick Start
1. Start PostgreSQL, MongoDB, Redis
2. `cd backend && source venv/bin/activate && python seed_data.py && uvicorn app.main:app --reload --port 8000`
3. `cd frontend && npm install && npm run dev`
4. Open `http://localhost:3000` (or 5173)
5. Login as `admin@kavyatransports.com` / `admin123`

### Admin Demo Flow
1. **Dashboard** → View KPIs (active trips, revenue, fleet utilization)
2. **Clients** → Browse 6 seeded clients, view contacts
3. **Vehicles** → Browse 8 vehicles, check compliance status
4. **Drivers** → Browse 6 drivers, view licenses and trip history
5. **Jobs** → View 28 jobs, create new job, submit for approval
6. **LR** → View lorry receipts, create new LR linked to a job
7. **Trips** → View 25 trips, create trip, start/complete trip flow
8. **Finance → Invoices** → View 10 invoices, create new invoice
9. **Finance → Payments** → Record payments against invoices
10. **Fleet → Dashboard** → Fleet KPIs, charts, alerts
11. **Settings** → Application settings

### Manager Demo
- Login as `manager@kavyatransports.com` / `demo123`
- Full access to operations, fleet, finance, and reports

### Fleet Manager Demo
- Login as `fleet@kavyatransports.com` / `demo123`
- Fleet dashboard, vehicle tracking, maintenance, fuel, alerts

### Accountant Demo
- Login as `accountant@kavyatransports.com` / `demo123`
- Accountant dashboard, invoices, receivables, payables, expenses, banking, ledger

### Project Associate Demo
- Login as `pa@kavyatransports.com` / `demo123`
- PA dashboard with job pipeline, create LRs, manage trips, upload documents

### Driver Demo
- Login as `driver@kavyatransports.com` / `demo123`
- Driver trips page, view assigned trips, submit expenses, manage documents

---

*End of Handover Document*
