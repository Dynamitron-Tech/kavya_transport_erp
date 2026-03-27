# Kavya Transport ERP

A full-stack Enterprise Resource Planning system for transport and logistics operations. Manages fleet, drivers, jobs, trips, lorry receipts (LR), finance, compliance, and real-time GPS tracking.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React Frontend │────▶│  FastAPI Backend  │────▶│  PostgreSQL / Mongo │
│  (Vite + TS)    │     │  (Python 3.11+)  │     │  Redis / Celery     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                              ▲
                    ┌─────────┴─────────┐
                    │   Flutter Apps    │
                    │  (Dart / Mobile)  │
                    └───────────────────┘
```

| Component | Stack | Port |
|-----------|-------|------|
| **Backend API** | FastAPI 0.109, SQLAlchemy 2.0 (async), Celery | `8000` |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand | `5173` |
| **Driver App** (`flutter_driver_app/`) | Flutter 3.x, Riverpod, Dio, Google Maps | Android / Web |
| **Management App** (`kavya_app/`) | Flutter 3.x, Riverpod, Dio, fl_chart | Android / iOS / Web |
| **Database** | PostgreSQL (primary), MongoDB (logs/tracking) | `5432` / `27017` |
| **Cache/Broker** | Redis | `6379` |

---

## Project Structure

```
kavya_transport_erp/
├── backend/                   # FastAPI REST API
│   ├── app/
│   │   ├── main.py            # App entrypoint, lifespan, CORS
│   │   ├── api/v1/endpoints/  # 30 endpoint modules
│   │   ├── core/              # config, security (JWT)
│   │   ├── db/                # PostgreSQL & MongoDB connections
│   │   ├── middleware/        # RBAC permissions
│   │   ├── models/            # SQLAlchemy & Mongo document models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic (S3, email, SMS)
│   │   ├── tasks/             # Celery background tasks
│   │   ├── utils/             # Number generators, helpers
│   │   └── websocket/         # Real-time connection manager
│   ├── alembic/               # Database migrations
│   ├── tests/                 # pytest-asyncio test suite
│   ├── seed_data.py           # Demo data seeder
│   └── requirements.txt
├── frontend/                  # React SPA
│   └── src/
│       ├── components/        # Reusable UI components
│       ├── pages/             # 20 page modules (dashboard, jobs, LR, etc.)
│       ├── services/          # Axios API clients
│       ├── store/             # Zustand state stores
│       ├── types/             # TypeScript type definitions
│       └── utils/             # Helpers, role routing
├── flutter_driver_app/        # Mobile app for drivers (production-ready)
│   └── lib/
│       ├── screens/           # 11 screens (login, trips, expenses, etc.)
│       ├── providers/         # Riverpod state providers
│       ├── services/          # API & location services
│       ├── models/            # Dart data models
│       └── widgets/           # Reusable Flutter widgets
└── kavya_app/                 # Multi-role management app (WIP)
    └── lib/
        ├── screens/           # 22 screens (fleet, accountant, associate)
        ├── providers/         # Riverpod state providers
        ├── services/          # API, auth, offline, notification services
        ├── models/            # Dart data models
        └── core/              # Theme, router, reusable widgets
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL 15+
- MongoDB 6+
- Redis 7+
- Flutter SDK 3.10+ (for driver app)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and API keys

# Run database migrations
alembic upgrade head

# Seed demo data (optional)
python seed_data.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

npm install
npm run dev        # Dev server on http://localhost:5173
npm run build      # Production build
npm run test       # Run Vitest tests
```

### Driver App Setup

```bash
cd flutter_driver_app

flutter pub get
flutter run              # Android device/emulator
flutter run -d chrome    # Web (for testing)
```

### Management App Setup (kavya_app)

```bash
cd kavya_app

flutter pub get
flutter run              # Android device/emulator
flutter run -d chrome    # Web (for testing)
```

> **Note:** `kavya_app` is work-in-progress — router not fully wired, some screens use mock data.

---

## Environment Variables

The backend reads from `backend/.env`. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key | *(must change in prod)* |
| `POSTGRES_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_DB` | PostgreSQL connection | `localhost:5432` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB` | MongoDB database name | `transport_erp_logs` |
| `REDIS_HOST` / `_PORT` | Redis connection | `localhost:6379` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` | S3 file storage | — |
| `GOOGLE_MAPS_API_KEY` | Google Maps geocoding & routes | — |
| `FIREBASE_CREDENTIALS_PATH` | FCM push notifications | — |
| `MSG91_API_KEY` | SMS gateway | — |
| `WHATSAPP_API_KEY` | Gupshup WhatsApp API | — |
| `RAZORPAY_KEY_ID` / `_SECRET` | Payment gateway | — |
| `VAHAN_API_KEY` | Vehicle registration lookup | — |
| `SARATHI_API_KEY` | Driving license verification | — |
| `ECHALLAN_API_KEY` | Traffic violation checks | — |
| `EWAY_BILL_USERNAME` / `_PASSWORD` / `_GSTIN` | E-way bill generation | — |

---

## API Overview

**Base URL:** `/api/v1`
**Auth:** Bearer JWT tokens (HS256, 30-min access, 7-day refresh)
**Response envelope:** `{ "success": bool, "data": ..., "message": str, "pagination": {...} }`

### Endpoints

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Auth** | `POST /auth/login`, `/auth/refresh`, `/auth/me` | Login, token refresh, current user |
| **Users** | `GET/POST/PUT/DELETE /users` | User CRUD, role assignment |
| **Clients** | `GET/POST/PUT/DELETE /clients` | Customers, contacts, addresses |
| **Vehicles** | `GET/POST/PUT/DELETE /vehicles` | Fleet, documents, maintenance, tyres |
| **Drivers** | `GET/POST/PUT/DELETE /drivers` | Profiles, licenses, attendance, documents |
| **Jobs** | `GET/POST/PUT/DELETE /jobs`, `/jobs/{id}/status`, `/jobs/{id}/assign` | Job lifecycle with status machine |
| **LR** | `GET/POST/PUT/DELETE /lr` | Lorry receipts with line items |
| **Trips** | `GET/POST/PUT/DELETE /trips`, `/trips/{id}/expenses`, `/trips/{id}/fuel` | Trip management, expenses, fuel logs |
| **Finance** | `/invoices`, `/payments`, `/ledger`, `/receivables`, `/payables` | Invoicing, payments, ledger entries |
| **E-way Bill** | `GET/POST /eway-bills`, `/eway-bills/{id}/generate` | GST e-way bill generation |
| **Tracking** | `POST /tracking/gps`, `GET /tracking/trips/{id}` | GPS telemetry ingest & playback |
| **Dashboard** | `GET /dashboard/stats`, `/dashboard/charts` | Aggregated KPIs |
| **Documents** | `GET/POST /documents`, `/documents/{id}/versions` | File uploads with versioning (S3) |
| **Reports** | `GET /reports/revenue`, `/reports/fleet`, `/reports/driver-performance` | Analytics & exports |
| **Admin** | `GET /admin/users`, `/admin/roles`, `/admin/permissions` | System administration |
| **Fleet Manager** | `/fleet/dashboard`, `/fleet/vehicles`, `/fleet/maintenance` | Fleet ops dashboard |
| **Accountant** | `/accountant/dashboard`, `/accountant/invoices`, `/accountant/banking` | Finance ops dashboard |
| **Notifications** | `GET/POST /notifications` | Push/SMS/WhatsApp notifications |
| **Fuel** | `GET/POST /fuel` | Fuel price tracking, consumption |
| **Maps** | `GET /maps/geocode`, `/maps/route` | Google Maps integration |
| **Gov APIs** | `/vahan/lookup`, `/sarathi/verify`, `/echallan/check`, `/gst/verify` | Government service integrations |
| **Tyre** | `GET/POST /tyres`, `/tyres/{id}/events` | Tyre lifecycle tracking |
| **Service** | `GET/POST /services` | Vehicle service records |

### Interactive Docs

- **Swagger UI:** `http://localhost:8000/api/v1/docs`
- **ReDoc:** `http://localhost:8000/api/v1/redoc`

---

## Authentication & RBAC

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `manager` | Operations management |
| `fleet_manager` | Fleet, vehicles, drivers, maintenance |
| `accountant` | Finance, invoicing, payments |
| `project_associate` | Jobs, LRs, trips operations |
| `driver` | Own trips, expenses, documents (mobile) |

### Auth Flow

```
POST /api/v1/auth/login  →  { access_token, refresh_token }
POST /api/v1/auth/refresh →  { access_token }  (using refresh_token)
GET  /api/v1/auth/me      →  Current user profile + permissions
```

All protected endpoints require `Authorization: Bearer <access_token>` header.

---

## Data Models

### PostgreSQL (Primary)

| Model | Key Fields |
|-------|------------|
| **User** | email, hashed_password, roles, tenant_id, branch_id |
| **Client** | name, contacts[], addresses[], gstin |
| **Vehicle** | registration_number, type, documents[], maintenance[], tyres[] |
| **Driver** | first_name, phone, license, documents[], attendance[] |
| **Job** | job_number (auto: `JOB-YYMMDD-NNNN`), client_id, origin/destination, status, agreed_rate |
| **LR** | lr_number (auto), job_id, consignor/consignee, items[], weight |
| **Trip** | trip_number (auto), job_id, vehicle_id, driver_id, expenses[], fuel_entries[] |
| **Invoice** | invoice_number (auto), client_id, items[], total, gst, status |
| **Payment** | amount, method, reference, invoice_id |
| **EwayBill** | eway_bill_number, lr_id, gstin, validity |

### MongoDB (Logs & Tracking)

| Collection | Purpose | TTL |
|------------|---------|-----|
| `gps_tracking` | GPS telemetry points | 30 days |
| `audit_logs` | User action audit trail | — |
| `notification_logs` | SMS/Push/WhatsApp logs | — |
| `analytics_snapshots` | Dashboard metric snapshots | — |
| `document_activity` | File upload/download logs | — |

### Job Status Machine

```
draft → pending_approval → approved → in_progress → completed
                                  ↘ cancelled
```

---

## Background Tasks (Celery)

Requires Redis as broker. Start worker with:

```bash
celery -A app.celery_app worker --loglevel=info
celery -A app.celery_app beat --loglevel=info   # Scheduled tasks
```

| Schedule | Task | Frequency |
|----------|------|-----------|
| Compliance check | Scan expiring documents/licenses | Daily |
| E-way bill sync | Refresh e-way bill statuses | Hourly |
| Fuel prices | Update fuel price database | Every 6 hours |

---

## WebSocket

Real-time events via WebSocket at `/ws`:

```javascript
const ws = new WebSocket("ws://localhost:8000/ws?token=<jwt>");
// Events: gps_update, trip_alert, notification
```

---

## Testing

### Backend

```bash
cd backend
pytest                        # Run all tests
pytest tests/test_jobs.py     # Run specific test file
pytest -v --tb=long           # Verbose with full tracebacks
```

Tests use **SQLite in-memory** database (no PostgreSQL needed) with a mock admin user. Test suite covers:

- `test_auth.py` — Login, token refresh, protected routes
- `test_jobs.py` — Job CRUD, status transitions, assignment
- `test_clients.py` — Client CRUD
- `test_vehicles.py` — Vehicle management
- `test_drivers.py` — Driver management
- `test_lr.py` — Lorry receipt operations
- `test_trips.py` — Trip lifecycle
- `test_finance.py` — Invoicing, payments, ledger
- `test_business_logic.py` — Cross-module business rules
- `test_data_flow.py` — End-to-end data flows
- `test_full_connectivity.py` — API connectivity checks

### Frontend

```bash
cd frontend
npm run test          # Vitest watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
```

---

## Third-Party Integrations

| Service | Provider | Purpose |
|---------|----------|---------|
| Maps & Geocoding | Google Maps | Route calculation, geocoding, distance |
| File Storage | AWS S3 | Document uploads, presigned URLs |
| SMS | MSG91 | OTP, notifications |
| WhatsApp | Gupshup | Delivery notifications |
| Push Notifications | Firebase (FCM) | Driver app alerts |
| Payments | Razorpay | Online payment collection |
| Vehicle Info | VAHAN (NIC) | Registration & RC verification |
| License Verify | Sarathi (NIC) | Driving license validation |
| Challans | eChallan | Traffic violation history |
| E-way Bills | GST Portal | E-way bill generation & validation |

---

## Frontend Pages

The React SPA includes pages for all roles:

- **Dashboard** — KPIs, recent jobs, revenue charts
- **Clients** — List, detail, contacts, addresses
- **Vehicles** — Fleet list, detail, documents, maintenance
- **Drivers** — Profiles, dashboard, attendance, compliance
- **Jobs** — Create, list, detail, status management
- **LR (Lorry Receipts)** — Create, list, detail
- **Trips** — Create, list, detail, route calculator
- **E-way Bills** — List, detail, generate
- **Finance** — Invoices, payments, ledger, receivables, payables, banking
- **Documents** — Upload, list, versioning
- **Tracking** — Live GPS map, trip replay
- **Reports** — Revenue, fleet, driver performance
- **Fleet Manager Portal** — Vehicles, drivers, maintenance, fuel, tyres, alerts
- **Accountant Portal** — Invoices, expenses, fuel, banking, reports
- **Settings** — Notifications, system configuration

---

## Mobile Apps

### Driver App (`flutter_driver_app/`) — Production Ready

Built with Flutter for drivers in the field:

| Screen | Purpose |
|--------|---------|
| Login | Phone/email authentication |
| Home | Today's tasks summary |
| Today | Current day trips & tasks |
| Trip List | All assigned trips |
| Trip Detail | Trip info, route, status updates |
| Add Expense | Log trip expenses with photos |
| Expense List | View submitted expenses |
| Documents | Upload/view driver documents |
| Notifications | Push notification center |
| Profile | Driver profile management |
| Checklist | Pre-trip vehicle inspection |

**Key dependencies:** Riverpod (state), Dio (HTTP), Google Maps, Geolocator, Firebase Messaging, Hive (offline storage).

### Management App (`kavya_app/`) — Work in Progress

Multi-role Flutter app for office staff (fleet managers, accountants, project associates):

| Module | Screens | Features |
|--------|---------|----------|
| **Fleet Manager** | 7 screens | Dashboard, live map, vehicle list/detail, service logs, tyre events, expense approval |
| **Accountant** | 6 screens | Financial dashboard, invoices, receivables, payments, expense approval |
| **Project Associate** | 6 screens | Job list, LR creation, e-way bill generation, trip closing, doc upload |
| **Auth** | 2 screens | Login, web-only redirect for admin/manager roles |
| **Shared** | 2 screens | Profile, notifications |

**Status:** 22 screens with full UI, but ~40% use mock data. Router not fully wired to screens. No Android permissions declared. Offline sync is a skeleton.

**Key dependencies:** Riverpod (state), Dio (HTTP), fl_chart, Google Maps, Firebase Messaging, Hive, Google Fonts.

---

## Health Checks

```
GET /health          →  { "status": "healthy", "version": "1.0.0" }
GET /health/ready    →  { "status": "ready", "checks": { "postgres": true, "mongodb": true } }
```

---

## Deployment Notes

- Set `DEBUG=false` and change `SECRET_KEY` in production
- Configure `CORS_ORIGINS` to match your frontend domain
- Use `gunicorn` with uvicorn workers for production: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker`
- Database pool: `pool_size=20`, `max_overflow=10` (configurable)
- MongoDB TTL indexes auto-created on startup (30-day GPS data, 90-day fuel logs)
- Run Celery worker + beat for background task processing
- Frontend: `npm run build` → serve `dist/` via nginx or CDN

---

## License

Proprietary — Kavya Transports. All rights reserved.
