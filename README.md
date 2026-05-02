# Kavya Transport ERP — Full System Workflow Guide

A full-stack, multi-platform Enterprise Resource Planning (ERP) system for transport and logistics operations. Manages fleet, drivers, jobs, trips, lorry receipts (LR), finance, compliance, real-time GPS tracking, fuel pump operations, e-way bills, document OCR, AI automation, and driver payroll settlements.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Tech Stack Overview](#tech-stack-overview)
3. [Backend Workflow](#backend-workflow)
4. [Frontend Workflow](#frontend-workflow)
5. [Mobile App Workflow](#mobile-app-workflow)
6. [Authentication & RBAC Workflow](#authentication--rbac-workflow)
7. [Core Business Workflows](#core-business-workflows)
8. [Real-time & Background Processing](#real-time--background-processing)
9. [Integration Workflows](#integration-workflows)
10. [Project Structure](#project-structure)
11. [Getting Started](#getting-started)
12. [Environment Variables](#environment-variables)
13. [API Overview](#api-overview)
14. [Testing](#testing)
15. [Database Design](#database-design)
16. [WebSocket](#websocket)
17. [Health Checks](#health-checks)
18. [Deployment Notes](#deployment-notes)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                   │
│                                                                        │
│  ┌─────────────────────┐         ┌────────────────────────────────┐  │
│  │   React Frontend    │         │      Flutter Mobile App        │  │
│  │  (Vite + TS + TW)   │         │  (Android / iOS / Web)         │  │
│  │  Port: 5173         │         │  Riverpod + go_router + Dio    │  │
│  └──────────┬──────────┘         └───────────────┬────────────────┘  │
└─────────────┼──────────────────────────────────────┼─────────────────┘
              │  HTTP + WebSocket (JWT Bearer)        │ HTTP + WebSocket
              ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       API LAYER                                       │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  FastAPI 0.109  (ASGI / Uvicorn)   Port: 8000                   │ │
│  │  REST API  (/api/v1/...)  |  WebSocket (/ws)                    │ │
│  │  RBAC Middleware  |  JWT Auth  |  Branch Isolation              │ │
│  └──────────┬───────────────────────────────────────┬──────────────┘ │
└─────────────┼───────────────────────────────────────┼────────────────┘
              │                                        │
     ┌────────▼──────────┐             ┌──────────────▼────────────────┐
     │   Services Layer  │             │     Background Workers         │
     │  Business Logic   │             │  Celery tasks + APScheduler   │
     └────────┬──────────┘             └──────────────┬────────────────┘
              │                                        │
┌─────────────▼────────────────────────────────────────▼────────────────┐
│                      DATA LAYER                                         │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  PostgreSQL  │  │   MongoDB    │  │  Redis   │  │   AWS S3      │  │
│  │  (primary)   │  │  (logs/GPS)  │  │  (cache) │  │  (documents)  │  │
│  │  Port: 5432  │  │  Port:27017  │  │  : 6379  │  │               │  │
│  └──────────────┘  └──────────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Component | Stack | Port |
|-----------|-------|------|
| **Backend API** | FastAPI 0.109, SQLAlchemy 2.0 (async), Celery | `8000` |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand | `5173` |
| **Mobile App** | Flutter 3.x, Riverpod 2.x, Dio, fl_chart, Google Maps | Android / iOS / Web |
| **PostgreSQL** | Primary relational database | `5432` |
| **MongoDB** | GPS telemetry, audit logs | `27017` |
| **Redis** | Cache, Celery message broker | `6379` |
| **AWS S3** | File/document storage | — |

---

## Tech Stack Overview

### Backend
| Layer | Technology |
|---|---|
| API Framework | FastAPI 0.109 |
| ORM | SQLAlchemy 2.0 (async) + `asyncpg` |
| Migrations | Alembic 1.13 |
| Primary DB | PostgreSQL 15 |
| Document DB | MongoDB 6 (`motor` async driver) |
| Cache / Broker | Redis 7 |
| Task Queue | Celery (background tasks) |
| Scheduling | APScheduler (cron automation) |
| Validation | Pydantic v2 + `pydantic-settings` |
| Auth | JWT (`python-jose`), `passlib[bcrypt]` |
| Storage | AWS S3 (`boto3`) |
| Email | `aiosmtplib`, Brevo |
| SMS / OTP | MSG91 |
| WhatsApp | Gupshup API |
| OCR / AI | Anthropic Claude API, HuggingFace Donut, Tesseract, OpenCV, PyTorch |
| Reports | `openpyxl`, `reportlab` (PDF) |
| Real-time | WebSocket connection manager |
| Server | Uvicorn (ASGI) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | TailwindCSS 3, `tailwind-merge`, `clsx` |
| Routing | React Router DOM v6 |
| State | Zustand 4.5 |
| Server State | TanStack React Query v5 |
| Forms | React Hook Form v7 + Zod |
| HTTP | Axios 1.6 |
| Charts | Recharts 2 |
| Maps | Leaflet + react-leaflet |
| Icons | Lucide React |
| PDF Export | jsPDF + jsPDF-autotable |
| OCR (browser) | Tesseract.js |
| Testing | Vitest + Testing Library + Playwright |

### Mobile App
| Layer | Technology |
|---|---|
| Framework | Flutter 3.x (Dart SDK ^3.9.2) |
| State | Riverpod 2.6 + `riverpod_annotation` |
| Navigation | go_router 17 |
| HTTP | Dio 5.9 + pretty_dio_logger |
| Local Storage | flutter_secure_storage, Hive |
| Maps | google_maps_flutter, flutter_map |
| OCR | google_mlkit_text_recognition (offline) |
| Push Notif. | Firebase Messaging + flutter_local_notifications |
| Background | flutter_background_service (GPS) |
| Auth | local_auth (biometrics) |
| Payments | Razorpay |
| Offline | Hive-backed sync queue |

---

## Backend Workflow

The backend is a layered FastAPI application. Every incoming request flows through this pipeline:

```
HTTP Request
    │
    ▼
Uvicorn ASGI Server (app/main.py)
    │
    ▼
CORS Middleware  →  Branch Isolation Middleware  →  RBAC Permission Middleware
    │
    ▼
API Router  (app/api/v1/router.py)
    │  Route matched to one of 60+ endpoint modules
    ▼
Endpoint Function  (app/api/v1/endpoints/<module>.py)
    │  Validates JWT, decodes payload (user_id, roles, branch_id)
    │  Validates request body via Pydantic schema
    ▼
Service Layer  (app/services/<module>.py)
    │  Business logic, cross-module orchestration
    ▼
SQLAlchemy Async Session  ──►  PostgreSQL (transactional data)
                           ──►  Motor Async Client  ──►  MongoDB (logs/GPS)
                           ──►  Redis (cache, token blacklist)
                           ──►  AWS S3 (file uploads)
    │
    ▼
Pydantic Response Schema  →  JSON Response
```

### Directory Layout

```
backend/app/
├── main.py                   # App entrypoint, lifespan hooks, CORS, APScheduler
├── celery_app.py             # Celery worker + beat definition
├── core/
│   ├── config.py             # Pydantic settings (reads .env)
│   └── security.py           # JWT creation/verification, bcrypt hashing
├── db/
│   ├── postgres/             # AsyncEngine, AsyncSessionLocal, init_db()
│   └── mongodb/              # Motor async client + collection refs
├── api/v1/
│   ├── router.py             # Master router — registers all endpoint modules
│   └── endpoints/            # 60+ domain endpoint files:
│       auth, users, admin, vehicles, drivers, jobs, lr, trips,
│       finance, finance_automation, banking, tracking, reports,
│       dashboard, documents, fleet_manager, accountant, tyre,
│       service, vahan, sarathi, echallan, gst, notifications,
│       fuel, fuel_pump, maps, suppliers, market_trips, geofences,
│       compliance, driver_scoring, customer_portal, supplier_portal,
│       branches, tpms, intelligence, sync, payables, receivable_payments,
│       user_notifications, reconciliation, pa_dashboard, manager_dashboard,
│       document_ocr, driver_requests, expenses, invoice_batches, ...
├── models/
│   ├── postgres/             # 30+ SQLAlchemy ORM models
│   └── mongodb/              # Mongo document models (logs/tracking)
├── schemas/                  # 21 Pydantic request/response schema files
├── services/                 # 80+ business logic services
├── tasks/                    # 14 Celery background task modules
├── schedulers/               # APScheduler TMS cron jobs
├── middleware/
│   ├── permissions.py        # RBAC permission enforcement
│   └── branch_isolation.py   # Per-branch data scoping
├── utils/                    # Auto-number generators, helpers
└── websocket/                # Real-time WebSocket connection manager
```

### Database Strategy

| Database | Purpose | Driver |
|---|---|---|
| PostgreSQL 15 | All transactional data (users, jobs, trips, finance) | `asyncpg` via SQLAlchemy 2 |
| MongoDB 6 | GPS telemetry, audit logs, notification logs | `motor` async |
| Redis 7 | Response caching, JWT blacklist, Celery broker | `redis` / `aioredis` |
| AWS S3 | Document/file storage with presigned URLs | `boto3` |

**Alembic migrations** cover 50+ revisions, from initial schema (`57d811c868b8`) through full schema evolution. Run `alembic upgrade head` to apply all.

### Roles & Permissions

| Role | Key Access |
|---|---|
| `admin` | Full system — all endpoints |
| `fleet_manager` | Fleet, vehicles, drivers, trips, maintenance, tyre, service |
| `accountant` | Finance, invoicing, banking, payments, ledger, reconciliation |
| `finance_manager` | Finance dashboard, automation, payable/receivable management |
| `branch_manager` | Branch-scoped trips, drivers, reports |
| `associate` | Jobs, LRs, e-way bills, trip creation, document upload |
| `pa` | Project associate dashboard, expense approval |
| `driver` | Own trips, expenses, ePOD, documents (mobile only) |
| `pump_operator` | Fuel pump dashboard, shift, dispense logs |
| `market_driver` | Market trip flows |
| `customer` | Customer portal — own jobs/LRs/invoices |
| `supplier` | Supplier portal — own payables/settlements |

---

## Frontend Workflow

The React SPA is a multi-role single-page application. The rendering and navigation workflow:

```
Browser Loads  →  Vite Dev Server / Static Build
    │
    ▼
main.tsx  →  App.tsx  →  React Router v6
    │
    ├── Auth check (authStore / Zustand)
    │       JWT in localStorage?  No  →  redirect to /login
    │       Yes  →  decode roles from JWT payload
    │
    ▼
Role-based routing  (utils/role routing)
    │
    ├── admin / manager       →  /admin/*
    ├── fleet_manager         →  /fleet/*
    ├── accountant            →  /accountant/*
    ├── finance_manager       →  /finance-manager/*
    ├── associate / pa        →  /jobs, /lr, /trips, /documents
    └── branch_manager        →  /branch/*
    │
    ▼
DashboardLayout  (components/layout/)
    │   Sidebar + Navbar (role-filtered menu items)
    │   WebSocket connection: ws://API/ws?token=<jwt>
    │   Listens: gps_update, trip_alert, notification events
    │
    ▼
Page Component  (pages/<role>/<page>.tsx)
    │
    ├── TanStack Query — fetch data from API
    │       useQuery / useMutation → services/api.ts (Axios)
    │       Auto-caches, background-refetches, invalidates on WS events
    │
    ├── React Hook Form + Zod — form validation
    │
    ├── Zustand store — global cross-component state
    │       authStore: user session, JWT
    │       bankingStore, ewbStore, financeAlertStore
    │
    └── Render UI with TailwindCSS + Lucide icons
```

### API Integration Layer

```
services/api.ts  (Axios instance)
    │
    ├── Base URL: /api/v1
    ├── Request interceptor: inject  Authorization: Bearer <token>
    ├── Response interceptor:
    │       401  →  call POST /auth/refresh
    │               success → retry original request with new token
    │               failure → logout, redirect to /login
    └── Returns typed response data
```

### Frontend Directory Layout

```
frontend/src/
├── main.tsx                  # React app entry
├── App.tsx                   # Router setup, QueryClient, toast provider
├── components/
│   ├── auth/                 # ProtectedRoute, RoleGuard
│   ├── common/               # Tables, modals, buttons, pagination
│   ├── layout/               # AppShell, Sidebar, Navbar, DashboardLayout
│   ├── fleet/                # Fleet-domain widgets
│   ├── documents/            # Document viewer, upload
│   ├── DocumentScanner/      # Browser OCR scanning (Tesseract.js)
│   ├── InvoiceWorkspace/     # Invoice creation canvas
│   ├── modules/              # Feature-level reusable modules
│   └── tyres/                # Tyre management components
├── pages/                    # 25+ role-scoped page folders:
│   accountant/, admin/, auth/, banking/, clients/,
│   dashboard/, documents/, driver/, drivers/,
│   eway-bill/, finance/, finance-manager/, fleet/,
│   jobs/, lr/, market-trips/, masters/, portal/,
│   pump/, reports/, settings/, suppliers/,
│   tracking/, trips/, vehicles/
├── services/
│   ├── api.ts                # Axios instance + interceptors
│   ├── authService.ts        # Login / logout / token refresh
│   ├── dataService.ts        # Generic CRUD layer
│   ├── financeManagerService.ts
│   ├── fuelPumpService.ts
│   ├── invoiceWorkspaceService.ts
│   ├── ocrService.ts         # Tesseract.js wrapper
│   ├── websocketService.ts   # WS connection + event dispatch
│   ├── tyreWebSocket.ts      # Tyre alerts WS
│   ├── useRealtimeDashboard.ts
│   └── workflowService.ts
├── store/                    # Zustand global state:
│   ├── authStore.ts          # User session, JWT, roles
│   ├── appStore.ts           # App-wide state
│   ├── bankingStore.ts
│   ├── ewbStore.ts           # E-way bill staging
│   └── financeAlertStore.ts
├── types/
│   ├── index.ts              # Core TypeScript type definitions
│   └── finance.ts            # Finance-specific types
├── hooks/                    # Custom React hooks
├── utils/                    # Role routing, number formatting, helpers
└── styles/                   # Global CSS
```

### Key Pages & Features

| Page Group | Features |
|---|---|
| **Dashboard** | KPI cards, revenue charts (Recharts), real-time WS updates, smart suggestions (pending jobs, overdue invoices, idle vehicles, expiring docs) |
| **Jobs** | Create/edit, status machine, Kanban pipeline view, assign vehicle/driver |
| **LR (Lorry Receipts)** | Create with line items, print PDF, link to job |
| **Trips** | Create, route calculator (Google Maps), expense entries, fuel logs, timeline view |
| **Finance** | Invoices, payments, ledger, receivables, payables, bank reconciliation |
| **E-way Bills** | Generate from LR, live validity countdown, portal sync |
| **Tracking** | Live GPS map (Leaflet), trip replay with history |
| **Documents** | Upload to S3, version history, OCR scan in browser |
| **Fleet Manager Portal** | Vehicles, drivers, maintenance schedule, fuel consumption, tyre events, compliance alerts |
| **Accountant Portal** | Invoice aging, payment recording, bank statements, GST reports |
| **Reports** | Revenue, fleet utilisation, driver performance — export to PDF/Excel |
| **Admin** | User management, role assignment, system settings |

---

## Mobile App Workflow

The Flutter app serves all field staff and office roles from a single codebase, routing each user to their role-specific home screen after login.

### App Boot & Auth Flow

```
app launch  →  SplashScreen
    │
    ▼
flutter_secure_storage  →  JWT stored?
    │   No  →  LoginScreen
    │           POST /api/v1/auth/login
    │           Store access_token + refresh_token securely
    │
    │   Yes →  Validate token (check expiry)
    │           Expired? → POST /api/v1/auth/refresh
    │
    ▼
Decode JWT  →  extract roles[]
    │
    ▼
go_router redirect  →  Role-based home screen
    ├── driver        →  /driver/today
    ├── fleet_manager →  /fleet/home
    ├── accountant    →  /accountant/home
    ├── associate     →  /associate/home
    ├── branch_manager→  /branch/home
    ├── pump_operator →  /pump/home
    └── admin/manager →  (redirect to web frontend)
```

### Networking Workflow (Dio)

```
Riverpod Provider triggers API call
    │
    ▼
api_service.dart  (Dio instance)
    │
    ├── BaseOptions: baseUrl = API_BASE_URL (dart-define)
    ├── Interceptor: inject Authorization: Bearer <token>
    │
    │   Response 401?
    │       →  auth_service.dart: POST /auth/refresh
    │           new token stored → retry original request
    │
    ▼
Parsed Dart model  →  Riverpod AsyncNotifier state updated
    →  Widget rebuilds
```

### Offline Sync Workflow

```
Device goes offline
    │
    ▼
ConnectivityPlus detects change
    │
    ▼
offline_sync_service.dart
    │   Write operations queued to Hive local DB
    │   (trip updates, expense entries, GPS points)
    │
Device comes online
    │
    ▼
offline_sync_provider detects connectivity restored
    │
    ▼
Hive queue drained → POST /api/v1/sync/batch
    │   Backend processes queued events in order
    │
    ▼
Sync status updated in UI (offline_sync_status provider)
```

### Background GPS Workflow

```
Driver starts trip  (trip_detail_screen.dart → "Start Trip")
    │
    ▼
flutter_background_service starts foreground service
    │
    ▼
Every 30 seconds:
    geolocator.getCurrentPosition()
        │
        ├── Online:  POST /api/v1/tracking/gps  (lat, lon, speed, timestamp, trip_id)
        │            Backend writes to MongoDB gps_tracking collection
        │            WebSocket broadcasts to fleet manager dashboard
        │
        └── Offline: GPS point written to Hive queue → synced later
    │
Driver ends trip → background service stopped
```

### ePOD (Electronic Proof of Delivery) Workflow

```
Driver arrives at delivery point
    │
    ▼
ePOD Screen — Step 1: Confirm delivery details
    │
    ▼
Step 2: Capture digital signature (canvas widget)
    │
    ▼
Step 3: Take delivery photo (camera plugin)
    │
    ▼
Step 4: Submit
    │   POST /api/v1/trips/{id}/epod
    │   Uploads signature + photo to S3
    │   Trip status → "delivered"
    │
    ▼
Fleet manager notified via WebSocket + FCM push
```

### Mobile App Directory Layout

```
kavya_app/lib/
├── main.dart
├── core/
│   ├── router/               # go_router (app_router.dart) + transitions
│   ├── theme/                # Design system / colour palette
│   ├── localization/         # i18n support
│   ├── widgets/              # Core reusable widgets
│   ├── services/             # DI wiring
│   └── exceptions/           # Custom exception types
├── models/                   # Dart data models (JSON serialisable)
├── providers/                # 23 Riverpod 2.x providers:
│   auth, fleet_dashboard, accountant_dashboard, admin_dashboard,
│   associate_dashboard, pump_dashboard, finance, jobs, vehicles,
│   trip, expense, live_tracking, notifications, intelligence,
│   connectivity, offline_sync_status, attendance, checklist,
│   driver_requests, search, cache_manager, recent_activity
├── services/
│   ├── api_service.dart      # Dio client, base URL, auth headers
│   ├── auth_service.dart     # Login, token storage, refresh
│   ├── background_gps_service.dart
│   ├── biometric_auth_service.dart
│   ├── location_service.dart
│   ├── notification_service.dart
│   ├── ocr_service.dart      # ML Kit OCR (offline receipt scanning)
│   ├── offline_sync_service.dart
│   ├── payment_service.dart  # Razorpay integration
│   └── websocket_service.dart
└── screens/
    ├── auth/                 # login_screen, splash_screen
    ├── driver/               # 20 screens: today, trip list/detail,
    │                         #   expenses, ePOD, GPS, settlement,
    │                         #   checklist, documents, leave, salary
    │                         #   advance, PIN verify, fuel entry,
    │                         #   notifications, profile, language
    ├── fleet/                # 23 screens: home, vehicles, add/edit vehicle,
    │                         #   trips, create trip, LR detail, drivers,
    │                         #   add driver, live map, analytics, tyres,
    │                         #   service log, market hub, driver approvals
    ├── accountant/           # 17 screens: home, invoices, payments,
    │                         #   banking, ledger, payables, receivables,
    │                         #   settlement, GST, vouchers, statements,
    │                         #   expense approval, auditor view
    ├── associate/            # 6 screens: home, LR create, EWB create,
    │                         #   job list, doc upload, trip close
    ├── branch/               # 5 screens: home (4-tab), trips, drivers,
    │                         #   reports, dashboard
    ├── pump/                 # 8 screens: home, dashboard, shift, fuel log,
    │                         #   dispense, tank refill, create tank, reports
    ├── fleet_manager/
    ├── pa/
    ├── market_driver/
    ├── profile/
    └── notifications/
```

---

## Authentication & RBAC Workflow

### Login Flow (All Clients)

```
User submits credentials
    │
    ▼
POST /api/v1/auth/login
    { email, password }
    │
    ▼
Backend:
    1. Lookup user by email (PostgreSQL)
    2. Verify bcrypt password hash
    3. Check account is active + roles assigned
    4. Generate JWT:
       payload = { user_id, email, roles[], permissions[], tenant_id, branch_id }
       access_token   (exp: 480 min)
       refresh_token  (exp: 30 days, HS256)
    │
    ▼
Response: { access_token, refresh_token, user: {...} }
    │
    ├── Frontend: store in Zustand authStore + localStorage
    └── Mobile: store in flutter_secure_storage
```

### Token Refresh Flow

```
API call returns 401
    │
    ▼
POST /api/v1/auth/refresh
    { refresh_token }
    │
    ▼
Backend validates refresh token (not blacklisted, not expired)
    │
    ▼
New access_token issued → client retries original request
```

### Logout Flow

```
User logs out
    │
    ▼
POST /api/v1/auth/logout
    │
    ▼
Backend adds refresh_token to Redis blacklist (TTL = remaining expiry)
    │
    ▼
Client clears stored tokens → redirects to login
```

### Per-request Authorization

```
Incoming request with  Authorization: Bearer <token>
    │
    ▼
JWTBearer dependency  →  Decode token  →  Verify signature + expiry
    │
    ▼
branch_isolation middleware  →  scope DB queries to user's branch_id
    │
    ▼
RBAC permissions middleware  →  check endpoint permission against roles[]
    │   Denied → 403 Forbidden
    │   Allowed → pass to endpoint
```

---

## Core Business Workflows

### 1. Job → Trip → Invoice Lifecycle

```
Client requests transport
    │
    ▼
Associate creates Job  (POST /api/v1/jobs)
    status: draft → pending_approval → approved
    Stores: client_id, origin, destination, agreed_rate, cargo details
    │
    ▼
Fleet Manager assigns Vehicle + Driver  (PUT /api/v1/jobs/{id}/assign)
    │
    ▼
Associate creates LR  (POST /api/v1/lr)
    Links to job_id; records consignor/consignee, items, weight
    Auto-generates LR number (format: LR-YYMMDD-NNNN)
    │
    ▼
Associate creates E-way Bill  (POST /api/v1/eway-bills/generate)
    Calls GST portal API → receives EWB number + validity
    │
    ▼
Associate creates Trip  (POST /api/v1/trips)
    Links: job_id, lr_id, vehicle_id, driver_id
    Auto-generates trip number
    status: planned → in_progress → completed
    │
    ├── Driver (mobile): GPS tracking starts (background service)
    ├── Driver (mobile): logs fuel fills, expenses during trip
    ├── Driver (mobile): submits ePOD on delivery
    │
    ▼
Trip completed → status: completed
    │
    ▼
Accountant generates Invoice  (POST /api/v1/invoices)
    Links to job_id, calculates: freight + extras − advances
    Auto-generates invoice number
    │
    ▼
Client pays → Accountant records Payment  (POST /api/v1/payments)
    Updates ledger + receivables
    Triggers driver settlement calculation
    │
    ▼
Driver Settlement  (POST /api/v1/settlements)
    Computes: agreed_driver_amount − expenses − advances
    Credited to driver ledger
```

### 2. Driver Expense Workflow (Mobile)

```
Driver on trip → Add Expense screen
    │   Categories: fuel, toll, loading, repair, advance
    ▼
POST /api/v1/trips/{id}/expenses
    amount, category, description, receipt_photo (→ S3)
    │
    ▼
Fleet Manager or PA reviews in approval queue
    │   Approve → expense confirmed, added to settlement calc
    │   Reject  → driver notified via FCM push
```

### 3. Fuel Pump Workflow (Mobile + Web)

```
Pump Operator logs in → /pump/home
    │
    ▼
Start Shift  (POST /api/v1/fuel-pump/shifts)
    Records: operator, pump_id, opening_reading
    │
    ▼
Vehicle arrives → Dispense Fuel
    POST /api/v1/fuel-pump/dispense
    Records: vehicle_reg, trip_id, litres, price_per_litre, amount
    │
    ▼
End Shift  →  POST /api/v1/fuel-pump/shifts/{id}/close
    Records closing_reading, total dispensed, cash collected
    │
    ▼
Celery task: fuel_theft_detection_service runs every 6h
    Cross-checks dispensed litres vs GPS distance / vehicle FE
    Flags anomalies → compliance alert
```

### 4. Compliance & Document Expiry Workflow

```
APScheduler cron (daily @ midnight)
    │
    ▼
compliance_alert service scans:
    Vehicle documents: RC, insurance, PUC, fitness, permit
    Driver documents: licence, medical fitness
    │
    Items expiring within 30 days
    │
    ▼
Compliance alert records created (PostgreSQL)
    │
    ├── Push notification → relevant fleet manager (FCM)
    ├── SMS alert → MSG91
    └── WhatsApp message → Gupshup
    │
Fleet Manager / Admin reviews alerts
    Uploads renewed documents → S3
    Alert marked resolved
```

### 5. Banking & Reconciliation Workflow

```
Bank statement received
    │
    ├── Manual upload (CSV/Excel) → bank_statement_parser service
    └── Auto-fetch (if bank API configured)
    │
    ▼
bank_match_engine service:
    Fuzzy-matches statement rows against:
    ├── Recorded payments
    ├── Supplier payables
    └── Misc bank entries
    │
Matched  →  mark reconciled
Unmatched → flagged for accountant review
    │
Accountant reviews flagged items in UI
    Creates manual ledger entry if needed
    │
Final reconciliation report → PDF export
```

### 6. Government API Integrations

```
Vehicle RC Verification:  POST /api/v1/vahan/lookup
    →  NIC VAHAN API  →  returns owner, chassis, engine, insurance

Driving Licence Verification:  POST /api/v1/sarathi/verify
    →  NIC Sarathi API  →  returns DL class, validity, endorsements

Traffic Violations:  POST /api/v1/echallan/check
    →  eChallan portal  →  returns pending challans for vehicle

GST Number Verification:  POST /api/v1/gst/verify
    →  GST portal API  →  returns GSTIN details, returns filing status

E-way Bill Generation:  POST /api/v1/eway-bills/generate
    →  GST EWB API  →  returns EWB number, QR code, validity
```

---

## Real-time & Background Processing

### WebSocket Events

Backend WebSocket endpoint: `ws://localhost:8000/ws?token=<jwt>`

```
Frontend / Mobile connects on login
    │
    ▼
connection_manager.py registers client (user_id → socket)
    │
Events broadcast by backend services:

gps_update     → {trip_id, lat, lon, speed, timestamp}
    Frontend: useRealtimeTrip hook → invalidates tracking query
    Mobile: live map updates vehicle marker position

trip_alert     → {trip_id, type, message}
    Frontend: toast notification + query invalidation
    Mobile: local notification shown

notification   → {title, body, meta}
    Frontend: notification badge count updated
    Mobile: flutter_local_notifications shown
```

### Celery Background Tasks

Start worker: `celery -A app.celery_app worker --loglevel=info`
Start beat: `celery -A app.celery_app beat --loglevel=info`

| Task Module | Schedule | What it Does |
|---|---|---|
| `tasks/compliance.py` | Daily | Scan expiring docs/licences, create alerts, send SMS/push |
| `tasks/eway_bill.py` | Hourly | Refresh e-way bill statuses from GST portal |
| `tasks/ewb_expiry.py` | Every 2h | Alert for EWBs expiring within 6 hours |
| `tasks/fuel_price.py` | Every 6h | Update fuel price database from market feeds |
| `tasks/geofence.py` | Every 5min | Check vehicle positions against geofence boundaries |
| `tasks/gps.py` | Every 30s | Aggregate GPS data, detect idle/stalled vehicles |
| `tasks/ialert.py` | Every 60s | Poll iAlert GPS provider for live vehicle data |
| `tasks/intelligence.py` | Daily | Run AI analysis, generate predictive maintenance alerts |
| `tasks/notification.py` | Continuous | Process notification queue (FCM, SMS, WhatsApp) |
| `tasks/banking.py` | Daily | Auto-match bank statement entries |
| `tasks/scoring.py` | Daily | Recalculate driver behaviour scores |
| `tasks/finance.py` | Daily | Auto-generate recurring invoices, payment reminders |
| `tasks/pipeline.py` | Continuous | Event pipeline processor |

### APScheduler (TMS Automation)

Runs inside the FastAPI process on startup (`schedulers/`).
Handles: automated trip assignment, route optimisation suggestions, predictive maintenance scheduling, invoice automation triggers.

---

## Integration Workflows

### Third-Party Services

| Service | Provider | Trigger | Flow |
|---|---|---|---|
| **Maps & Routes** | Google Maps | Route calculation, ETA | `maps_service.py` → Google Maps API → distance/duration matrix |
| **File Storage** | AWS S3 | Document uploads | `s3_service.py` → presigned PUT URL → client uploads directly |
| **SMS** | MSG91 | OTP, compliance alerts | `sms_service.py` → MSG91 API |
| **WhatsApp** | Gupshup | Delivery confirmations, alerts | `whatsapp_service.py` |
| **Push Notifications** | Firebase FCM | Driver alerts, trip events | `fcm_service.py` → Firebase Admin SDK |
| **Payments** | Razorpay | Online payment collection | `razorpay_service.py` + mobile `payment_service.dart` |
| **AI / OCR** | Anthropic Claude + Donut + Tesseract | Document data extraction | `document_ocr_service.py` → multi-model pipeline |
| **Email** | Brevo (Sendinblue) | Invoice delivery, alerts | `email_service.py` → Brevo API |

### Document OCR Workflow

```
Document uploaded (image or PDF)
    │
    ▼
POST /api/v1/document-ocr/extract
    │
    ▼
document_ocr_service pipeline:
    1. OpenCV pre-processing (deskew, denoise, contrast)
    2. Tesseract OCR → raw text
    3. HuggingFace Donut model → structured field extraction
       (for LR, invoice, RC, DL document types)
    4. Anthropic Claude API → validation + missing-field inference
    │
    ▼
Extracted fields returned as JSON
    Frontend / Mobile pre-fills form automatically
    User reviews → confirms → saves record
```

---

## Project Structure

```
kavya_transport_erp/
├── backend/
│   ├── app/
│   │   ├── main.py                  # App entrypoint, lifespan, CORS, scheduler
│   │   ├── celery_app.py            # Celery worker definition
│   │   ├── api/v1/
│   │   │   ├── router.py            # Master router
│   │   │   └── endpoints/           # 60+ endpoint modules
│   │   ├── core/                    # config.py, security.py
│   │   ├── db/                      # postgres/, mongodb/
│   │   ├── middleware/              # permissions.py, branch_isolation.py
│   │   ├── models/                  # postgres/ (30+ ORM), mongodb/
│   │   ├── schemas/                 # 21 Pydantic schema files
│   │   ├── services/                # 80+ business logic services
│   │   ├── tasks/                   # 14 Celery task modules
│   │   ├── schedulers/              # APScheduler TMS cron
│   │   ├── utils/                   # Number generators, helpers
│   │   └── websocket/               # WS connection manager
│   ├── alembic/                     # 50+ migration files
│   ├── tests/                       # pytest-asyncio test suite
│   ├── seed_data.py                 # Demo data seeder
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/              # Reusable UI components
│       ├── pages/                   # 25+ role-scoped page folders
│       ├── services/                # Axios API clients + WebSocket
│       ├── store/                   # Zustand state stores
│       ├── types/                   # TypeScript type definitions
│       └── utils/                   # Role routing, helpers
└── kavya_app/
    └── lib/
        ├── screens/                 # Role-gated screens (driver, fleet, accountant...)
        ├── providers/               # 23 Riverpod providers
        ├── services/                # API, auth, offline sync, background GPS
        ├── models/                  # Dart data models
        ├── widgets/                 # Reusable Flutter widgets
        └── core/                    # Theme, go_router, localization
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL 15+
- MongoDB 6+
- Redis 7+
- Flutter SDK 3.10+ (for kavya_app)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# .venv\Scripts\Activate.ps1   # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and API keys

# Run database migrations
alembic upgrade head

# Seed demo data (optional)
python seed_data.py

# Start the API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.celery_app worker --loglevel=info

# Start Celery beat scheduler (separate terminal)
celery -A app.celery_app beat --loglevel=info
```

### Frontend Setup

```bash
cd frontend

npm install
npm run dev        # Dev server on http://localhost:5173
npm run build      # Production build
npm run test       # Run Vitest unit tests
npm run test:e2e   # Run Playwright E2E tests
```

### Mobile App Setup (kavya_app)

```bash
cd kavya_app

flutter pub get

# Run on Android emulator
flutter run

# Run on web (for testing)
flutter run -d chrome

# Run with custom API URL (physical device or staging)
flutter run --dart-define=API_BASE_URL=http://YOUR_IP:8000/api/v1
```

> **Android emulator note:** Default API URL is `http://10.0.2.2:8000/api/v1` which maps the Android emulator's localhost to the host machine. Override with `--dart-define=API_BASE_URL=<url>` for physical devices.

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
| `ANTHROPIC_API_KEY` | Claude AI for OCR/document extraction | — |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:5173` |

---

## API Overview

**Base URL:** `/api/v1`
**Auth:** `Authorization: Bearer <access_token>` (JWT HS256)
**Access token expiry:** 480 minutes | **Refresh token expiry:** 30 days
**Response envelope:**
```json
{ "success": true, "data": {...}, "message": "OK", "pagination": {"page": 1, "total": 100} }
```

### Core Endpoints

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Auth** | `POST /auth/login`, `/auth/refresh`, `/auth/me`, `/auth/logout` | Login, token refresh, current user, logout |
| **Users** | `GET/POST/PUT/DELETE /users` | User CRUD, role assignment |
| **Clients** | `GET/POST/PUT/DELETE /clients` | Customers, contacts, addresses |
| **Vehicles** | `GET/POST/PUT/DELETE /vehicles` | Fleet registry, documents, maintenance, tyres |
| **Drivers** | `GET/POST/PUT/DELETE /drivers` | Profiles, licences, attendance, documents |
| **Jobs** | `GET/POST/PUT/DELETE /jobs`, `/jobs/{id}/status`, `/jobs/{id}/assign` | Job lifecycle with status machine |
| **LR** | `GET/POST/PUT/DELETE /lr` | Lorry receipts with line items |
| **Trips** | `GET/POST/PUT/DELETE /trips`, `/trips/{id}/expenses`, `/trips/{id}/fuel`, `/trips/{id}/epod` | Trip management, expenses, fuel logs, ePOD |
| **Finance** | `/invoices`, `/payments`, `/ledger`, `/receivables`, `/payables` | Invoicing, payments, ledger entries |
| **Banking** | `/banking`, `/banking/reconcile`, `/banking/statements` | Bank entries, auto-reconciliation |
| **E-way Bill** | `GET/POST /eway-bills`, `/eway-bills/{id}/generate` | GST e-way bill generation |
| **Tracking** | `POST /tracking/gps`, `GET /tracking/trips/{id}` | GPS telemetry ingest & playback |
| **Dashboard** | `GET /dashboard/stats`, `/dashboard/charts` | Aggregated KPIs and charts |
| **Documents** | `GET/POST /documents`, `/documents/{id}/versions` | File uploads with versioning (S3) |
| **Document OCR** | `POST /document-ocr/extract` | AI-powered field extraction from documents |
| **Reports** | `GET /reports/revenue`, `/reports/fleet`, `/reports/driver-performance` | Analytics & Excel/PDF exports |
| **Admin** | `GET /admin/users`, `/admin/roles`, `/admin/permissions` | System administration |
| **Fleet Manager** | `/fleet/dashboard`, `/fleet/vehicles`, `/fleet/maintenance` | Fleet ops dashboard |
| **Accountant** | `/accountant/dashboard`, `/accountant/invoices`, `/accountant/banking` | Finance ops dashboard |
| **Notifications** | `GET/POST /notifications` | Push / SMS / WhatsApp notifications |
| **Fuel** | `GET/POST /fuel`, `/fuel-pump/shifts`, `/fuel-pump/dispense` | Fuel price tracking, pump operations |
| **Maps** | `GET /maps/geocode`, `/maps/route` | Google Maps geocoding & routing |
| **Gov APIs** | `/vahan/lookup`, `/sarathi/verify`, `/echallan/check`, `/gst/verify` | Government service integrations |
| **Tyre** | `GET/POST /tyres`, `/tyres/{id}/events` | Tyre lifecycle tracking |
| **Service** | `GET/POST /services` | Vehicle service records |
| **Geofences** | `GET/POST /geofences` | Geofence zone management |
| **Compliance** | `GET /compliance/alerts` | Compliance alert dashboard |
| **Intelligence** | `GET /intelligence/insights` | AI-driven fleet intelligence |
| **Sync** | `POST /sync/batch` | Mobile offline sync batch endpoint |

### Interactive API Docs

- **Swagger UI:** `http://localhost:8000/api/v1/docs`
- **ReDoc:** `http://localhost:8000/api/v1/redoc`

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests (uses SQLite in-memory — no Postgres required)
pytest

# Run a specific module
pytest tests/test_jobs.py

# Verbose with full traceback
pytest -v --tb=long

# With coverage
pytest --cov=app
```

Test files:

| File | Covers |
|---|---|
| `test_auth.py` | Login, token refresh, protected routes |
| `test_jobs.py` | Job CRUD, status transitions, assignment |
| `test_clients.py` | Client CRUD |
| `test_vehicles.py` | Vehicle management |
| `test_drivers.py` | Driver management |
| `test_lr.py` | Lorry receipt operations |
| `test_trips.py` | Trip lifecycle |
| `test_finance.py` | Invoicing, payments, ledger |
| `test_business_logic.py` | Cross-module business rules |
| `test_data_flow.py` | End-to-end data flows |
| `test_full_connectivity.py` | API connectivity checks |

### Frontend Tests

```bash
cd frontend

npm run test          # Vitest watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
npm run test:e2e      # Playwright E2E tests
```

---

## Database Design

### PostgreSQL — Primary Relational Database

**Connection:** `asyncpg` driver via SQLAlchemy 2.0 async engine.
**Port:** `5432` (default)

All transactional models inherit `TimestampMixin` (`id`, `created_at`, `updated_at`) and most also inherit `SoftDeleteMixin` (`is_deleted`, `deleted_at`, `deleted_by`).

Multi-tenancy is enforced via `tenant_id` (FK → `tenants`) and `branch_id` (FK → `branches`) columns on most tables, filtered at the middleware layer.

---

#### Identity & Access Tables

**`tenants`** — Top-level organisation record
| Column | Type | Constraints |
|---|---|---|
| `name` | String(200) | not null |
| `slug` | String(100) | unique, not null |
| `domain` | String(255) | unique, nullable |
| `logo_url` | String(500) | nullable |
| `settings` | Text (JSON) | nullable |
| `subscription_plan` | String(50) | default='basic' |
| `subscription_valid_until` | DateTime | nullable |
| `is_active` | Boolean | default=True |

**`branches`** — Physical offices / depots under a tenant
| Column | Type | Constraints |
|---|---|---|
| `name` | String(100) | not null |
| `code` | String(20) | unique, not null |
| `address` / `city` / `state` / `pincode` | Text / String | nullable |
| `phone` / `email` | String | nullable |
| `is_active` | Boolean | default=True |
| `tenant_id` | Integer | FK→tenants.id |

**`users`** — All system users (admin, driver, accountant, etc.)
| Column | Type | Constraints |
|---|---|---|
| `email` | String(255) | unique, not null, index |
| `phone` | String(20) | unique, nullable, index |
| `password_hash` | String(255) | not null |
| `first_name` / `last_name` | String(100) | not null / nullable |
| `is_active` / `is_verified` | Boolean | default=True / False |
| `fcm_token` | String(512) | nullable (push notifications) |
| `employee_id` | String(20) | unique, nullable, index |
| `joining_date` / `date_of_birth` | Date | nullable |
| `bank_account_number` / `bank_ifsc` / `upi_id` | String | nullable |
| `dl_number` / `dl_expiry_date` | String / Date | nullable |
| `aadhaar_file_url` / `pan_file_url` / `dl_file_url` | Text | nullable (S3 URLs) |
| `branch_id` / `tenant_id` | Integer | FK refs |

**`roles`** — Role master (system-defined)
| Column | Type |
|---|---|
| `name` | String(50) unique |
| `display_name` | String(100) |
| `role_type` | Enum(RoleType) |
| `is_system` | Boolean |

**`permissions`** — Granular permission records
| Column | Type |
|---|---|
| `module` | String(50) |
| `action` | Enum(PermissionAction) |
| `resource` | String(100) |

**Association tables:** `user_roles` (user ↔ role M2M), `role_permissions` (role ↔ permission M2M), `user_role_assignments` (with `valid_from` / `valid_until`), `role_permission_assignments`

---

#### Fleet Tables

**`vehicles`** — Core fleet registry
| Column | Type | Notes |
|---|---|---|
| `registration_number` | String(20) | unique, not null |
| `vehicle_type` | Enum(VehicleType) | e.g. TRUCK, TRAILER, LCV |
| `make` / `model` / `year_of_manufacture` | String / Integer | |
| `chassis_number` / `engine_number` | String(50) | |
| `capacity_tons` / `capacity_volume` | Numeric(10,2) | |
| `num_axles` / `num_tyres` | Integer | defaults: 2 / nullable |
| `ownership_type` | Enum(OwnershipType) | OWNED / HIRED |
| `status` | Enum(VehicleStatus) | AVAILABLE / ON_TRIP / IN_MAINTENANCE |
| `current_latitude` / `current_longitude` | Numeric(10,8) / (11,8) | last known GPS |
| `odometer_reading` | Numeric(12,2) | default=0 |
| `fuel_type` / `fuel_tank_capacity` / `mileage_per_litre` | | |
| `gps_device_id` / `gps_provider` / `last_gps_at` | | iAlert / AIS140 |
| `fitness_valid_until` / `permit_valid_until` / `insurance_valid_until` / `puc_valid_until` | Date | compliance dates |
| `default_driver_id` | Integer | FK→drivers.id |
| `tenant_id` / `branch_id` | Integer | FK refs |

**`vehicle_documents`** — RC, insurance, permit, PUC files
| Column | Type |
|---|---|
| `vehicle_id` | FK→vehicles |
| `document_type` / `document_number` | String |
| `issue_date` / `expiry_date` | Date |
| `file_url` | String(500) — S3 link |
| `is_verified` / `verified_by` | Boolean / FK→users |

**`vehicle_maintenance`** — Service records
| Column | Type |
|---|---|
| `vehicle_id` | FK→vehicles |
| `maintenance_type` / `service_type` | String |
| `service_date` / `next_service_date` / `next_service_km` | Date / Numeric |
| `workshop_id` | FK→workshops |
| `parts_cost` / `labor_cost` / `total_cost` | Numeric(12,2) |
| `work_order_number` / `invoice_number` | String |

**`vehicle_tyres`** — Tyre registry per vehicle position
| Column | Type |
|---|---|
| `vehicle_id` / `position` | FK / String(20) |
| `tyre_number` / `brand` / `size` | String |
| `purchase_date` / `purchase_cost` | Date / Numeric |
| `current_km` / `km_at_fitment` | Numeric(12,2) |
| `condition` | String — good/warn/critical |
| `retread_count` / `max_retreads` | Integer |
| `sensor_id` / `last_psi` / `last_temperature_c` / `tread_depth_mm` | TPMS sensor data |

**`tyre_lifecycle_events`** — Fit / remove / retread / scrap events
**`tyre_sensor_readings`** — PSI + temperature time-series from TPMS sensors
**`tyre_readings`** — Manual field inspection entries (with photo)
**`tyre_alerts`** — Low PSI / high temp / low tread alerts (open → resolved)
**`tyre_thresholds`** — Per-vehicle alert thresholds (min_psi, critical_psi, min_tread_mm)
**`tyre_simulation_sessions`** — AI wear simulation results

**`workshops`** — Empanelled service centres

---

#### Driver Tables

**`drivers`** — Driver profiles
| Column | Type | Notes |
|---|---|---|
| `user_id` | FK→users | linked app account |
| `employee_code` | String(20) | unique, index |
| `first_name` / `last_name` / `father_name` | String | |
| `phone` | String(20) | not null, index |
| `aadhaar_number` / `pan_number` | String | |
| `status` | Enum(DriverStatus) | AVAILABLE / ON_TRIP / ON_LEAVE |
| `salary_type` / `base_salary` / `per_km_rate` | | payroll |
| `bank_account_number` / `bank_ifsc` / `upi_id` | String | settlement |
| `security_pin_hash` | String(128) | mobile biometric fallback |
| `is_hazmat_certified` / `is_adr_certified` | Boolean | |
| `tenant_id` / `branch_id` | Integer | FK refs |

**`driver_licenses`** — DL records with expiry and verification
**`driver_documents`** — Aadhaar, PAN, medical fitness, etc.
**`driver_attendance`** — Daily attendance with trip linkage

---

#### Operations Tables

**`jobs`** — Transport job orders
| Column | Type | Notes |
|---|---|---|
| `job_number` | String(30) | auto: `JOB-YYMMDD-NNNN` |
| `client_id` | FK→clients | |
| `origin_address` / `origin_city` / `origin_state` | | |
| `destination_address` / `destination_city` / `destination_state` | | |
| `origin_latitude/longitude` / `destination_latitude/longitude` | Numeric | GPS coords |
| `job_type` | Enum(JobType) | OWN / MARKET |
| `priority` | Enum(JobPriority) | NORMAL / HIGH / URGENT |
| `material_type` / `quantity` / `is_hazardous` | | cargo |
| `agreed_rate` / `loading_charges` / `unloading_charges` / `total_amount` | Numeric(15,2) | |
| `pickup_date` / `expected_delivery_date` | DateTime | |
| `status` | Enum(JobStatusEnum) | DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED / CANCELLED |
| `approved_by` / `approved_at` | FK→users / DateTime | |

**`job_status_history`** — Full audit trail of every job status change

**`lrs`** — Lorry receipts (freight consignment notes)
| Column | Type | Notes |
|---|---|---|
| `lr_number` | String(30) | auto-generated, index |
| `job_id` | FK→jobs | |
| `consignor_name` / `consignor_gstin` / `consignor_phone` | | sender details |
| `consignee_name` / `consignee_gstin` / `consignee_phone` | | receiver details |
| `vehicle_id` / `driver_id` / `trip_id` | FK refs | |
| `eway_bill_number` / `eway_bill_valid_until` | | GST compliance |
| `payment_mode` | Enum(PaymentMode) | TO_BE_BILLED / PAID / TO_PAY |
| `freight_amount` / `loading_charges` / `total_freight` | Numeric | |
| `declared_value` / `insurance_policy_number` | | cargo insurance |
| `status` | Enum(LRStatus) | DRAFT → ACTIVE → DELIVERED |
| `pod_uploaded` / `pod_file_url` / `pod_verified` | | proof of delivery |

**`lr_items`** — Line items per LR (description, HSN, packages, weight, rate, amount)
**`lr_documents`** — Supporting files attached to an LR

**`trips`** — Actual vehicle journeys
| Column | Type | Notes |
|---|---|---|
| `trip_number` | String(30) | auto-generated, index |
| `job_id` / `vehicle_id` / `driver_id` | FK refs | |
| `origin` / `destination` | String | |
| `planned_distance_km` / `actual_distance_km` | Numeric(10,2) | |
| `planned_start/end` / `actual_start/end` | DateTime | |
| `start_odometer` / `end_odometer` | Numeric(12,2) | |
| `actual_fuel_litres` / `fuel_cost` | Numeric | |
| `total_expense` / `revenue` / `profit_loss` | Numeric(12,2) | |
| `driver_advance` / `driver_pay` | Numeric(12,2) | |
| `status` | Enum(TripStatusEnum) | PLANNED → IN_PROGRESS → COMPLETED |
| `pod_collected` / `pod_completed_at` | | ePOD tracking |
| `expenses_verified` / `payment_approved` | Boolean | approval workflow |

**`trip_expenses`** — Per-trip expense entries (fuel, toll, food, repair, etc.)
**`trip_fuel_entries`** — Fuel fill records with odometer
**`trip_status_history`** — Audit trail, includes GPS coordinates at each status change

---

#### Finance Tables

**`invoices`** — Tax invoices issued to clients
| Column | Type | Notes |
|---|---|---|
| `invoice_number` | String(30) | auto-generated, index |
| `invoice_type` | Enum(InvoiceType) | TAX_INVOICE / PROFORMA / CREDIT_NOTE |
| `client_id` / `job_id` / `trip_id` | FK refs | |
| `billing_gstin` / `billing_state_code` | | GSTIN billing |
| `subtotal` / `discount_amount` / `taxable_amount` | Numeric(15,2) | |
| `cgst_rate` / `cgst_amount` | Numeric | intra-state GST |
| `sgst_rate` / `sgst_amount` | Numeric | intra-state GST |
| `igst_rate` / `igst_amount` | Numeric | inter-state GST |
| `total_tax` / `total_amount` | Numeric(15,2) | |
| `amount_paid` / `amount_due` | Numeric(15,2) | |
| `payment_status` | Enum(InvoicePaymentStatus) | UNPAID / PARTIAL / PAID |
| `status` | Enum(InvoiceStatus) | DRAFT / CONFIRMED / CANCELLED |
| `pdf_url` | String(500) | S3 link to generated PDF |

**`invoice_items`** — Line items per invoice (description, HSN/SAC, qty, rate, tax)

**`payments`** — Payment records (received from client or paid to vendor)
| Column | Type | Notes |
|---|---|---|
| `payment_number` | String(30) | unique, index |
| `invoice_id` / `client_id` / `vendor_id` / `trip_id` / `driver_id` | FK refs | |
| `amount` | Numeric(15,2) | |
| `payment_method` | Enum(PaymentMethod) | CASH / BANK_TRANSFER / CHEQUE / UPI / RAZORPAY |
| `cheque_number` / `cheque_date` | | cheque tracking |
| `razorpay_order_id` / `razorpay_payment_id` / `upi_txn_id` | | gateway refs |
| `tds_rate` / `tds_amount` / `net_amount` | Numeric | TDS deduction |
| `status` | Enum(PaymentStatus) | COMPLETED / PENDING / FAILED |
| `receipt_url` | String(500) | S3 receipt scan |

**`ledger`** — Double-entry ledger (every financial event creates a row)
| Column | Type | Notes |
|---|---|---|
| `entry_number` | String(30) | unique, index |
| `ledger_type` | Enum(LedgerType) | DEBIT / CREDIT |
| `account_name` / `account_code` | String | chart of accounts |
| `debit` / `credit` / `balance` | Numeric(15,2) | |
| `invoice_id` / `payment_id` / `trip_id` | FK refs | |

**`gst_entries`** — GSTR-1 / GSTR-3B filing records
| Column | Type |
|---|---|
| `financial_year` / `tax_period` | String |
| `invoice_number` / `party_gstin` | String |
| `taxable_value` / CGST / SGST / IGST amounts | Numeric |
| `filing_status` / `filed_at` | String / DateTime |

**`receivables`** — Aging bucket summary per client (current, 30-60d, 60-90d, 90d+)
**`payables`** — Aging bucket summary per vendor
**`vendors`** — Supplier master (name, GSTIN, PAN, bank details, TDS rate)
**`bank_accounts`** — Company bank accounts (account_number unique, current_balance, is_default)

---

#### Banking Tables

**`banking_entries`** — Every bank debit/credit logged
| Column | Type | Notes |
|---|---|---|
| `entry_no` | String | unique, index |
| `account_id` | FK→bank_accounts | |
| `entry_date` | Date | |
| `entry_type` | Enum(BankingEntryType) | RECEIPT / PAYMENT / TRANSFER / etc. |
| `amount_paise` | BigInteger | stored in paise (1 INR = 100 paise) |
| `client_id` / `job_id` / `invoice_id` | FK refs | |
| `reconciled` / `reconciled_at` | Boolean / DateTime | |

**`bank_csv_imports`** — Tracks each bank statement import batch
**`bank_csv_transactions`** — Individual rows from imported bank CSV, with match status linked to `banking_entries`

---

#### Compliance & Government Tables

**`eway_bills`** — GST E-way bill records
| Column | Type | Notes |
|---|---|---|
| `eway_bill_number` | String | unique, index |
| `status` | Enum | GENERATED / CANCELLED / EXPIRED |
| `valid_from` / `valid_until` / `extended_until` | DateTime | TTL tracking |
| `extension_count` / `extension_reason` | | |
| `supplier_gstin` / `recipient_gstin` | | |
| `transport_mode` | Enum | ROAD / RAIL / AIR / SHIP |
| `vehicle_number` / `transporter_id` | | |
| `taxable_value` / CGST / SGST / IGST amounts | Numeric | |
| `nic_response` | JSON | raw GST portal API response |
| `alert_8h/4h/1h_sent` | Boolean | expiry alert flags |

**`eway_items`** — HSN-wise item list per e-way bill

**`documents`** — Unified document store for all entity types
| Column | Type | Notes |
|---|---|---|
| `entity_type` | Enum | VEHICLE / DRIVER / JOB / TRIP / INVOICE |
| `entity_id` | Integer | the entity's PK |
| `document_type` | Enum | RC / INSURANCE / PUC / AADHAAR / etc. |
| `expiry_date` / `reminder_days` | Date / Integer | compliance tracking |
| `compliance_category` | Enum | |
| `approval_status` | Enum | PENDING / APPROVED / REJECTED |
| `file_url` / `file_key` | String | S3 stored |
| `extracted_data` | JSON | AI OCR result |

**`document_versions`** — Version history for every document upload

**`compliance_alerts`** — Auto-generated expiry / violation alerts
**`geofences`** — Polygon or circular geofence zones with speed limits
**`gps_providers`** — iAlert / AIS140 provider configuration
**`driver_events`** — Hard-braking, speeding, over-revving events from GPS
**`routes`** — Route master with origin/destination, distance, toll gates, via points
**`route_budgets`** — Per-vehicle-type budgeted cost per route
**`rate_charts`** — Client-specific freight rate tables per route + material type

---

#### Payroll & Payments Tables

**`company_expenses`** — Office/operational expenses (stored in paise)
**`payment_contacts`** — Razorpay contact + fund account registry
**`payouts`** — Razorpay payout records (driver settlements, vendor payments)
**`payment_schedules`** — Recurring payment rules (salary, EMI, etc.)
**`expense_submissions`** — Driver expense requests linked to payout workflow

---

#### Fuel Pump Tables

**`depot_fuel_tanks`** — Physical tanks with current stock
**`fuel_issues`** — Each refuelling event (vehicle + litres + cost + anomaly flag)
**`fuel_stock_transactions`** — Tank-level stock ledger (refill / issue / adjustment)
**`vehicle_fuel_logs`** — Mileage efficiency tracking per fill-up
**`fuel_theft_alerts`** — Anomaly detection flags (expected vs actual litres)

---

#### Other Tables

**`market_trips`** — Third-party contractor trips (supplier vehicle/driver hired per job)
**`clients`** — Customer master (GSTIN, PAN, credit limit, billing settings)
**`client_contacts`** — Multiple contacts per client
**`client_addresses`** — Multiple delivery/pickup addresses per client with GPS
**`suppliers`** — Transport contractors / outsourced carriers
**`supplier_vehicles`** — Vehicles registered under suppliers
**`notifications`** — In-app notifications (JSONB data, target_role, urgency, is_read)
**`fuel_prices`** — Daily diesel/petrol price by city (for rate calculations)
**`employee_attendance`** — Office staff check-in log with photo

---

### PostgreSQL Schema Diagram (Key Relationships)

```
tenants ──< branches ──< users ──< roles (M2M)
                    │
    ┌───────────────┼─────────────────────┐
    │               │                     │
  clients         vehicles             drivers
    │               │                     │
    └──> jobs <──────┴──────────────────> trips
            │                              │
           lrs ──> eway_bills        trip_expenses
                                     trip_fuel_entries
    invoices ──< invoice_items
       │
    payments ──> ledger ──> bank_accounts ──< banking_entries
                                               bank_csv_transactions
```

---

### MongoDB — Document Database

**Connection:** `motor` async driver
**Port:** `27017` (default)
**Database:** `transport_erp_logs` (configurable via `MONGODB_DB` env var)

MongoDB stores high-volume, append-only data that does not need relational joins.

#### Collections

**`gps_tracking`** — Real-time GPS telemetry points
```json
{
  "trip_id": 1234,
  "vehicle_id": 56,
  "driver_id": 78,
  "lat": 12.9716,
  "lon": 77.5946,
  "speed_kmph": 62.5,
  "heading": 270,
  "altitude_m": 920,
  "accuracy_m": 5.0,
  "gps_provider": "ialert",
  "device_id": "DV-001234",
  "timestamp": "2026-04-14T08:30:00Z",
  "created_at": "2026-04-14T08:30:02Z"
}
```
**TTL:** 30 days (TTL index on `timestamp`)
**Index:** `trip_id` + `timestamp` (compound)

---

**`audit_logs`** — User action audit trail
```json
{
  "user_id": 10,
  "user_email": "admin@kavya.in",
  "action": "UPDATE",
  "resource": "trips",
  "resource_id": 1234,
  "changes": { "status": ["planned", "in_progress"] },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 ...",
  "timestamp": "2026-04-14T09:00:00Z"
}
```
**TTL:** Indefinite (retained permanently)
**Index:** `user_id`, `resource`, `timestamp`

---

**`notification_logs`** — Delivery records for SMS / Push / WhatsApp
```json
{
  "notification_type": "sms",
  "provider": "msg91",
  "recipient_phone": "+919876543210",
  "template_id": "COMPLIANCE_ALERT",
  "message": "Vehicle TN-01-AB-1234 insurance expires in 7 days.",
  "status": "delivered",
  "provider_message_id": "MSG91-123456",
  "sent_at": "2026-04-14T07:00:00Z",
  "delivered_at": "2026-04-14T07:00:05Z"
}
```
**TTL:** 90 days

---

**`analytics_snapshots`** — Dashboard KPI metric snapshots (for chart history)
```json
{
  "snapshot_type": "daily_revenue",
  "branch_id": 1,
  "tenant_id": 1,
  "period": "2026-04-13",
  "metrics": {
    "total_revenue": 485000,
    "total_trips": 18,
    "avg_distance_km": 420,
    "fuel_consumed_litres": 1240,
    "active_vehicles": 22
  },
  "captured_at": "2026-04-14T00:05:00Z"
}
```
**TTL:** 90 days

---

**`document_activity`** — File upload / download / OCR event logs
```json
{
  "action": "ocr_extract",
  "document_type": "lr",
  "entity_type": "trips",
  "entity_id": 1234,
  "file_key": "uploads/lr/LR-260414-0023.pdf",
  "extracted_fields": ["lr_number", "consignee", "weight"],
  "confidence_score": 0.94,
  "user_id": 45,
  "duration_ms": 1820,
  "timestamp": "2026-04-14T10:15:00Z"
}
```
**TTL:** 90 days

---

#### MongoDB Index Strategy

| Collection | Index | Type |
|---|---|---|
| `gps_tracking` | `timestamp` | TTL (30 days) |
| `gps_tracking` | `trip_id + timestamp` | Compound |
| `gps_tracking` | `vehicle_id + timestamp` | Compound |
| `audit_logs` | `user_id`, `resource`, `timestamp` | Single field |
| `notification_logs` | `sent_at` | TTL (90 days) |
| `analytics_snapshots` | `captured_at` | TTL (90 days) |
| `analytics_snapshots` | `branch_id + snapshot_type + period` | Compound unique |
| `document_activity` | `timestamp` | TTL (90 days) |

---

### Redis — Cache & Message Broker

**Port:** `6379` (default)

| Key Pattern | Purpose | TTL |
|---|---|---|
| `token_blacklist:<token_hash>` | JWT logout blacklist | Token remaining expiry |
| `cache:dashboard:<branch_id>` | Dashboard KPI cache | 5 minutes |
| `cache:fuel_prices:<city>` | Fuel price cache | 6 hours |
| `geofence:<geofence_id>` | Geofence polygon cache | 30 minutes |
| `celery:*` | Celery task queue (broker) | — |
| `celery-beat:*` | Celery beat schedule state | — |

---

### Status Machine Reference

**Job:**
```
DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED
                                   ↘ CANCELLED
```

**Trip:**
```
PLANNED → IN_PROGRESS → COMPLETED
       ↘ CANCELLED
```

**LR:**
```
DRAFT → ACTIVE → DELIVERED
```

**Invoice:**
```
DRAFT → CONFIRMED → CANCELLED
```

**E-way Bill:**
```
GENERATED → EXTENDED (up to N times) → EXPIRED / CANCELLED
```

---

## WebSocket

Real-time events endpoint: `ws://localhost:8000/ws?token=<jwt>`

```javascript
// Frontend
const ws = new WebSocket("ws://localhost:8000/ws?token=" + accessToken);
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // type: "gps_update" | "trip_alert" | "notification"
};
```

| Event | Payload | Consumers |
|---|---|---|
| `gps_update` | `{ trip_id, lat, lon, speed, timestamp }` | Live tracking map (web + mobile) |
| `trip_alert` | `{ trip_id, type, message }` | Fleet manager dashboard |
| `notification` | `{ title, body, meta }` | Notification badge / inbox |

---

## Health Checks

```
GET /health       →  { "status": "healthy", "version": "1.0.0" }
GET /health/ready →  { "status": "ready", "checks": { "postgres": true, "mongodb": true, "redis": true } }
```

---

## Deployment Notes

- Set `DEBUG=false` and rotate `SECRET_KEY` in production.
- Configure `CORS_ORIGINS` to match your exact frontend domain.
- Production API server: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker`
- Run Celery worker + beat processes alongside the API server.
- MongoDB TTL indexes are auto-created on startup (30-day GPS, 90-day fuel/notification logs).
- Frontend production build: `npm run build` → serve `dist/` via nginx or a CDN.
- Mobile release: `flutter build apk --release` (Android) / `flutter build ipa` (iOS).

---

## License

Proprietary — Kavya Transports. All rights reserved.