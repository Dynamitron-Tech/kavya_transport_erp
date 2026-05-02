# Kavya Transport ERP — Windows Setup Guide

> Complete guide for running the project on Windows 10/11 — local development and AWS production deployment.
> All commands use **PowerShell** (run as Administrator where noted). Git Bash or WSL2 are alternatives where stated.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What You Need Before Starting](#2-what-you-need-before-starting)
   - 2.1 [Install Chocolatey (Windows Package Manager)](#21-install-chocolatey-windows-package-manager)
   - 2.2 [Install Core Tools](#22-install-core-tools)
   - 2.3 [Redis on Windows — WSL2 Setup](#23-redis-on-windows--wsl2-setup)
3. [Local Development Setup](#3-local-development-setup)
   - 3.1 [PostgreSQL Database](#31-postgresql-database)
   - 3.2 [Redis (via WSL2)](#32-redis-via-wsl2)
   - 3.3 [MongoDB](#33-mongodb)
   - 3.4 [Backend (FastAPI)](#34-backend-fastapi)
   - 3.5 [Frontend (React)](#35-frontend-react)
   - 3.6 [Flutter Mobile App](#36-flutter-mobile-app)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [AWS Production Deployment](#5-aws-production-deployment)
   - 5.1 [Infrastructure Overview](#51-infrastructure-overview)
   - 5.2 [Provision AWS Infrastructure](#52-provision-aws-infrastructure)
   - 5.3 [Server Setup on EC2](#53-server-setup-on-ec2)
   - 5.4 [Deploy the Application](#54-deploy-the-application)
   - 5.5 [Nginx + SSL (HTTPS)](#55-nginx--ssl-https)
   - 5.6 [Systemd Services](#56-systemd-services)
6. [Data Flow & Architecture](#6-data-flow--architecture)
7. [Default Login Credentials](#7-default-login-credentials)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Project Overview

Kavya Transport ERP is a full-stack logistics management system with three layers:

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python / FastAPI | REST API, business logic, auth |
| **Frontend** | React + TypeScript + Vite | Web dashboard (port 3000) |
| **Mobile App** | Flutter (Android/iOS) | Driver & fleet management app |

**Databases used:**
- PostgreSQL 15 — primary relational data (jobs, trips, finance, users)
- Redis 7 — caching, Celery task queue
- MongoDB — logging, GPS telemetry, audit trails

---

## 2. What You Need Before Starting

### 2.1 Install Chocolatey (Windows Package Manager)

Open **PowerShell as Administrator** and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

Close and reopen PowerShell as Administrator to pick up `choco` in your PATH.

---

### 2.2 Install Core Tools

Run all of these in **PowerShell as Administrator**:

```powershell
# Python 3.11
choco install python311 -y

# Node.js 20 LTS
choco install nodejs-lts -y

# Git
choco install git -y

# AWS CLI (only needed for AWS deployment)
choco install awscli -y

# jq (JSON processor, used in AWS scripts)
choco install jq -y

# PostgreSQL 15
choco install postgresql15 --params "/Password:your_strong_password_here" -y

# MongoDB 7
choco install mongodb -y
```

After installation, close and reopen PowerShell so all new commands are available.

**Verify versions:**

```powershell
python --version        # Should show 3.11.x
node --version          # Should show v20.x.x
git --version
psql --version          # Should show 15.x
mongosh --version
aws --version
```

> **Note:** Redis does **not** have an official Windows build. Use WSL2 (see next section) — it is the recommended approach.

---

### 2.3 Redis on Windows — WSL2 Setup

Redis runs inside WSL2 (Windows Subsystem for Linux). This is a one-time setup.

**Step 1 — Enable WSL2**

In **PowerShell as Administrator**:

```powershell
wsl --install
# Reboot when prompted
```

After reboot, Ubuntu will open and ask you to create a Linux username and password. Set those up, then continue.

**Step 2 — Install Redis inside WSL2**

Open the **Ubuntu** app (from Start menu) and run:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y redis-server

# Start Redis
sudo service redis-server start

# Verify
redis-cli ping
# Expected: PONG
```

**Step 3 — Make Redis start automatically**

In the same Ubuntu terminal:

```bash
# Add to ~/.bashrc so Redis auto-starts when WSL opens
echo "sudo service redis-server start > /dev/null 2>&1" >> ~/.bashrc
```

> **Alternative (without WSL2):** Install [Memurai](https://www.memurai.com/) — a Redis-compatible server for Windows. Free Developer Edition. After install it runs as a Windows Service on port 6379 automatically.

---

## 3. Local Development Setup

### 3.1 PostgreSQL Database

Chocolatey installs PostgreSQL as a Windows Service that starts automatically.

**Verify the service is running:**

```powershell
Get-Service postgresql*
# Status should show "Running"

# If not running:
Start-Service postgresql-x64-15
```

**Create the application database and user:**

Open PowerShell and connect to PostgreSQL:

```powershell
# The superuser is "postgres". Password was set during choco install above.
psql -U postgres
```

Inside the `psql` prompt, run:

```sql
CREATE USER transport_erp WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE transport_erp OWNER transport_erp;
GRANT ALL PRIVILEGES ON DATABASE transport_erp TO transport_erp;
\q
```

> **Important:** Use the same password in your `.env` file in step 3.4.

**Add psql to PATH (if `psql` command is not found):**

```powershell
# Find the PostgreSQL bin directory (adjust version if needed)
$pgPath = "C:\Program Files\PostgreSQL\15\bin"

# Add to current session
$env:PATH += ";$pgPath"

# Add permanently
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$pgPath", "Machine")
```

---

### 3.2 Redis (via WSL2)

Redis runs inside WSL2. You start it from the Ubuntu terminal:

```bash
# Open Ubuntu from Start menu, then:
sudo service redis-server start
redis-cli ping
# Expected: PONG
```

Redis will be accessible from Windows on `localhost:6379` — WSL2 bridges the network automatically.

**Keep the Ubuntu window open** while running the project (or use the Memurai alternative which runs in the background as a Windows Service).

---

### 3.3 MongoDB

Chocolatey installs MongoDB as a Windows Service.

**Verify it is running:**

```powershell
Get-Service MongoDB
# Status should show "Running"

# If not running:
Start-Service MongoDB
```

**Verify the connection:**

```powershell
mongosh --eval "db.adminCommand('ping')"
# Expected output contains: ok: 1
```

> MongoDB will create the `transport_erp_logs` database automatically on first use.

---

### 3.4 Backend (FastAPI)

Open **PowerShell** (no need for Administrator here) and follow these steps.

**Step 1 — Navigate to the backend folder**

```powershell
cd "C:\Users\rheni\OneDrive\Desktop\Kavya_erp-Rhenius"
```

> Adjust the path to wherever you extracted the project zip.

**Step 2 — Create and activate a Python virtual environment**

```powershell
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1
```

> If you get an error about execution policy, run this first (once):
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Then re-run the Activate command.

You should see `(.venv)` prefix in your terminal prompt.

**Step 3 — Install Python dependencies**

```powershell
pip install --upgrade pip
pip install -r backend\requirements.txt
```

> `psycopg2-binary` in `requirements.txt` works on Windows with no extra steps. If it fails, run:
> ```powershell
> pip install psycopg2-binary --only-binary=:all:
> ```

**Step 4 — Create the `.env` file**

Create the file at `backend\.env`. Open it in Notepad or VS Code:

```powershell
notepad backend\.env
# Or: code backend\.env
```

Paste and fill in the following:

```env
# ── Application ────────────────────────────────────────────
APP_NAME=Transport ERP
ENVIRONMENT=development
DEBUG=true

# ── Security ────────────────────────────────────────────────
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=REPLACE_WITH_64_CHAR_HEX_STRING_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── PostgreSQL ──────────────────────────────────────────────
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=transport_erp
POSTGRES_PASSWORD=your_strong_password_here
POSTGRES_DB=transport_erp

# ── MongoDB ─────────────────────────────────────────────────
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB=transport_erp_logs

# ── Redis ───────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# ── CORS ────────────────────────────────────────────────────
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# ── File Storage (AWS S3) ───────────────────────────────────
# Leave blank for local file storage during development
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET=kavya-transports-uploads-prod

# ── Email (SMTP) ────────────────────────────────────────────
# Leave blank to skip email sending in development
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@kavyatransports.com
```

**Generate a SECRET_KEY:**

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
# Copy the output and paste as the SECRET_KEY value in .env
```

**Step 5 — Run database migrations**

```powershell
# Make sure you are in the project root and venv is active
cd backend
alembic upgrade head
cd ..
```

This creates all tables in PostgreSQL automatically.

**Step 6 — Seed the database with initial data**

```powershell
cd backend
python seed_data.py
python seed_permissions.py
cd ..
```

This creates admin users, sample clients, vehicles, drivers, jobs, and trips.

**Step 7 — Start the backend server**

```powershell
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is now running at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

Leave this terminal open. Open new terminals for the next steps.

---

### 3.5 Frontend (React)

Open a **new PowerShell window**:

```powershell
cd "C:\Users\rheni\OneDrive\Desktop\Kavya_erp-Rhenius\frontend"

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

The web app is now available at: `http://localhost:3000`

> If the dev server starts on port 5173 instead of 3000, open `frontend\vite.config.ts` and check the `server.port` setting.

**Optional — create `frontend\.env`:**

```powershell
notepad frontend\.env
```

```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

### 3.6 Flutter Mobile App

**Install Flutter SDK on Windows:**

1. Download the Flutter SDK zip from https://flutter.dev/docs/get-started/install/windows
2. Extract to `C:\flutter` (avoid paths with spaces)
3. Add to PATH permanently:

```powershell
# Run as Administrator
[Environment]::SetEnvironmentVariable(
    "PATH",
    $env:PATH + ";C:\flutter\bin",
    "Machine"
)
```

Close and reopen PowerShell.

4. Verify Flutter and fix dependencies:

```powershell
flutter doctor
# Review the output and fix anything marked with [X]
```

Common `flutter doctor` fixes on Windows:
- **Android toolchain**: Install Android Studio from https://developer.android.com/studio, then run `flutter doctor --android-licenses`
- **Visual Studio**: Install Visual Studio 2022 with "Desktop development with C++" workload (required for Windows desktop targets)

**Run the mobile app:**

Open a **new PowerShell window**:

```powershell
cd "C:\Users\rheni\OneDrive\Desktop\Kavya_erp-Rhenius\kavya_app"

# Download all Flutter packages
flutter pub get

# Run code generation (required once after pub get)
dart run build_runner build --delete-conflicting-outputs

# List available devices/emulators
flutter devices

# Run on Android emulator (replace emulator-5554 with your device ID from above)
flutter run -d emulator-5554

# Or run on a Windows desktop target
flutter run -d windows
```

**Configure the API URL for the app:**

On Android emulator, `10.0.2.2` maps to your Windows host `localhost`:

```powershell
flutter run -d emulator-5554 `
  --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

For a physical Android device on the same Wi-Fi network:

```powershell
# Find your Windows local IP
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter (e.g. 192.168.1.10)

flutter run -d YOUR_DEVICE_ID `
  --dart-define=API_BASE_URL=http://192.168.1.10:8000/api/v1
```

**Firebase setup (required for push notifications):**

1. Go to https://console.firebase.google.com → create project `kavya-transports`
2. Add Android app with package `com.kavya.transport`
3. Download `google-services.json` → place at `kavya_app\android\app\google-services.json`
4. Add iOS app → download `GoogleService-Info.plist` → place at `kavya_app\ios\Runner\GoogleService-Info.plist`

> Push notifications will not work without this. The rest of the app works fine without Firebase.

---

## 4. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | YES | JWT signing key — min 64 hex chars |
| `POSTGRES_PASSWORD` | YES | PostgreSQL password you set in step 3.1 |
| `POSTGRES_USER` | YES | PostgreSQL username (default: transport_erp) |
| `POSTGRES_DB` | YES | Database name (default: transport_erp) |
| `MONGODB_URL` | YES | MongoDB connection string |
| `REDIS_HOST` | YES | Redis host (default: localhost) |
| `CORS_ORIGINS` | YES | JSON array of allowed frontend URLs |
| `AWS_ACCESS_KEY_ID` | Production | S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | Production | S3 file uploads |
| `S3_BUCKET` | Production | S3 bucket name |
| `SMTP_HOST` | Optional | For sending emails |
| `DEBUG` | Dev only | Set false in production |

---

## 5. AWS Production Deployment

> The production server is Linux (Ubuntu 22.04 on EC2). You SSH into it from your Windows machine using PowerShell (OpenSSH is built into Windows 10/11) or Git Bash.

### 5.1 Infrastructure Overview

```
Internet
    │
    ▼
Route 53 (DNS)
    │
    ▼
EC2 t3.medium (Ubuntu 22.04) — ap-south-1 Mumbai
├── Nginx (port 80/443)
│   ├── → Frontend (static files served from /var/www/kavya/frontend/dist)
│   └── → Backend (proxy to uvicorn on 127.0.0.1:8000)
├── uvicorn (FastAPI, port 8000, localhost only)
├── Celery Worker (background tasks)
└── Celery Beat (scheduled jobs)
    │
    ├── RDS PostgreSQL 15 (db.t3.small) — private subnet
    ├── ElastiCache Redis 7 (cache.t3.micro) — private subnet
    ├── MongoDB Atlas M10 (or DocumentDB) — external/private
    └── S3 Bucket (file uploads)
```

**Estimated monthly AWS cost:**
- EC2 t3.medium: ~$30
- RDS db.t3.small: ~$25
- ElastiCache cache.t3.micro: ~$13
- MongoDB Atlas M10: ~$57
- S3 + data transfer: ~$5
- **Total: ~$130/month**

---

### 5.2 Provision AWS Infrastructure

**Configure AWS CLI (run in PowerShell):**

```powershell
aws configure
# Enter: Access Key ID, Secret Access Key, Region: ap-south-1, Output: json
```

**Create an EC2 key pair and save the .pem file:**

```powershell
# Create key pair and save to your home directory
aws ec2 create-key-pair `
  --key-name kavya-prod-key `
  --query 'KeyMaterial' `
  --output text | Out-File -FilePath "$HOME\kavya-prod-key.pem" -Encoding ascii

# Set correct permissions (Windows equivalent of chmod 400)
icacls "$HOME\kavya-prod-key.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

**Run the provisioner script from Git Bash or WSL2:**

The provisioner is a bash script (`scripts/aws_provision.sh`). Run it from **WSL2** or **Git Bash**:

```bash
# In WSL2 Ubuntu or Git Bash terminal:
cd /mnt/c/Users/rheni/OneDrive/Desktop/Kavya_erp-Rhenius

SKIP_DOCDB=true KEY_PAIR_NAME=kavya-prod-key bash scripts/aws_provision.sh
```

> To open Git Bash: right-click the project folder in File Explorer → "Git Bash Here"

The script creates:
- VPC with public + private subnets
- EC2 instance (Ubuntu 22.04)
- RDS PostgreSQL in private subnet
- ElastiCache Redis in private subnet
- S3 bucket with private access
- IAM user + policy for app S3 access

**Save the EC2 public IP and RDS/Redis endpoints printed at the end** — you will need them in the production `.env`.

---

### 5.3 Server Setup on EC2

**SSH into the server from PowerShell:**

```powershell
ssh -i "$HOME\kavya-prod-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

> If you get a permission warning about the `.pem` file, ensure only your user has access (the `icacls` command above handles this).

**Once connected to EC2 (all remaining commands in this section are on the Linux server):**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip \
    nginx git curl build-essential libpq-dev

# Install Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Create a non-root user for the app:**

```bash
sudo useradd -m -s /bin/bash kavya
sudo mkdir -p /var/www/kavya
sudo chown kavya:kavya /var/www/kavya
```

---

### 5.4 Deploy the Application

**Step 1 — Upload the project to EC2 (from your Windows PowerShell):**

```powershell
# From Windows PowerShell — scp is built into Windows 10/11
scp -i "$HOME\kavya-prod-key.pem" -r `
  "C:\Users\rheni\OneDrive\Desktop\Kavya_erp-Rhenius" `
  ubuntu@YOUR_EC2_IP:/var/www/kavya/
```

**Step 2 — Backend setup on the server (back in your SSH session):**

```bash
sudo -u kavya bash

cd /var/www/kavya

# Create venv
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

**Step 3 — Create production `.env` on the server:**

```bash
nano /var/www/kavya/backend/.env
```

Fill in production values:

```env
APP_NAME=Transport ERP
ENVIRONMENT=production
DEBUG=false

SECRET_KEY=GENERATE_NEW_64_CHAR_HEX_STRING

# PostgreSQL (use RDS endpoint from aws_provision.sh output)
POSTGRES_HOST=YOUR-RDS-ENDPOINT.ap-south-1.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_USER=transport_erp
POSTGRES_PASSWORD=YOUR_RDS_PASSWORD
POSTGRES_DB=transport_erp

# MongoDB (use Atlas connection string)
MONGODB_URL=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/transport_erp_logs

# Redis (use ElastiCache endpoint)
REDIS_HOST=YOUR-REDIS.cache.amazonaws.com
REDIS_PORT=6379
REDIS_DB=0

# CORS — your actual domain
CORS_ORIGINS=["https://kavyatransports.com","https://www.kavyatransports.com"]

# S3 (from IAM user created by provisioner)
AWS_ACCESS_KEY_ID=YOUR_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_IAM_SECRET_KEY
AWS_REGION=ap-south-1
S3_BUCKET=kavya-transports-uploads-prod

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@kavyatransports.com
```

**Step 4 — Run migrations and seed data:**

```bash
cd /var/www/kavya/backend
source /var/www/kavya/venv/bin/activate

alembic upgrade head
python seed_data.py
python seed_permissions.py
```

**Step 5 — Build the frontend:**

```bash
cd /var/www/kavya/frontend
npm install
npm run build
# Output goes to frontend/dist/
```

---

### 5.5 Nginx + SSL (HTTPS)

```bash
sudo cp /var/www/kavya/scripts/nginx_kavyatransports.conf \
  /etc/nginx/sites-available/kavyatransports.com

sudo nano /etc/nginx/sites-available/kavyatransports.com
# Edit the domain name to match your actual domain

sudo ln -s /etc/nginx/sites-available/kavyatransports.com \
           /etc/nginx/sites-enabled/kavyatransports.com

sudo rm /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

**Install SSL certificate (Let's Encrypt — free):**

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d kavyatransports.com -d www.kavyatransports.com

# Auto-renewal
echo "0 3 * * * root /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'" \
  | sudo tee /etc/cron.d/certbot-renew
```

---

### 5.6 Systemd Services

```bash
sudo cp /var/www/kavya/scripts/kavya-api.service           /etc/systemd/system/
sudo cp /var/www/kavya/scripts/kavya-celery-worker.service /etc/systemd/system/
sudo cp /var/www/kavya/scripts/kavya-celery-beat.service   /etc/systemd/system/

sudo systemctl daemon-reload

sudo systemctl enable kavya-api kavya-celery-worker kavya-celery-beat
sudo systemctl start  kavya-api kavya-celery-worker kavya-celery-beat

# Verify
sudo systemctl status kavya-api
sudo journalctl -u kavya-api -f
```

**Production app is live:**
- Frontend: `https://kavyatransports.com`
- API docs: `https://kavyatransports.com/api/v1/docs`

---

## 6. Data Flow & Architecture

```
Flutter App / React Frontend
        │
        │  HTTPS (JWT in Authorization header)
        ▼
    Nginx (port 443)
        │
        ├─ /api/*  → FastAPI (uvicorn port 8000)
        │               │
        │               ├── PostgreSQL (jobs, trips, finance, users)
        │               ├── Redis (token cache, Celery queue)
        │               ├── MongoDB (logs, GPS data, audit trail)
        │               ├── S3 (uploaded documents, POD photos)
        │               └── Celery Workers (background jobs)
        │
        └─ /*      → React static files (frontend/dist/)
```

**Authentication flow:**
1. User logs in → `POST /api/v1/auth/login` → returns `access_token` + `refresh_token`
2. Every request includes `Authorization: Bearer <access_token>`
3. Token contains: user_id, email, roles, permissions, branch_id, tenant_id
4. Access token expires in 30 minutes; use refresh token to get a new one

**Background task flow (Celery):**
- Celery worker picks up tasks from the Redis queue
- Tasks include: scheduled reports, invoice reminders, GPS tracking aggregation
- Celery Beat runs scheduled cron jobs (daily/weekly summaries)

---

## 7. Default Login Credentials

After running `seed_data.py`:

| Role | Email | Password |
|---|---|---|
| **Admin** | admin@kavyatransports.com | admin123 |
| Manager | manager@kavyatransports.com | manager123 |
| Fleet Manager | fleet@kavyatransports.com | fleet123 |
| Accountant | accountant@kavyatransports.com | accountant123 |
| Project Associate | associate@kavyatransports.com | associate123 |
| Driver | driver@kavyatransports.com | driver123 |

> **Change all passwords immediately in production** via the admin panel or the change-password API endpoint.

---

## 8. Troubleshooting

### PowerShell execution policy error when activating venv

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Then retry:
.\.venv\Scripts\Activate.ps1
```

---

### Backend won't start — "SECRET_KEY must be set"

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
# Copy output into backend\.env as the SECRET_KEY value
```

---

### `alembic upgrade head` fails — "can't connect to PostgreSQL"

1. Check the service is running:
   ```powershell
   Get-Service postgresql*
   Start-Service postgresql-x64-15  # if stopped
   ```
2. Verify `POSTGRES_PASSWORD` in `backend\.env` matches what you set in psql
3. Test the connection directly:
   ```powershell
   psql -U transport_erp -d transport_erp -h localhost
   ```

---

### `psql` command not found

```powershell
# Add PostgreSQL bin to PATH for the current session
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"

# Or add it permanently (run as Administrator)
[Environment]::SetEnvironmentVariable(
    "PATH",
    [Environment]::GetEnvironmentVariable("PATH","Machine") + ";C:\Program Files\PostgreSQL\15\bin",
    "Machine"
)
```

---

### Redis connection refused

The most common cause is that the WSL2 Ubuntu terminal was closed.

```bash
# Re-open Ubuntu from Start menu and run:
sudo service redis-server start
redis-cli ping   # Should return PONG
```

If using Memurai:

```powershell
Get-Service Memurai
Start-Service Memurai
```

---

### MongoDB not running

```powershell
Get-Service MongoDB
Start-Service MongoDB

# Verify
mongosh --eval "db.adminCommand('ping')"
```

---

### `pip install -r requirements.txt` fails on `psycopg2-binary`

```powershell
pip install psycopg2-binary --only-binary=:all:
```

---

### Frontend shows blank page or API CORS errors

Check browser console (F12 → Console). If you see CORS errors, ensure `backend\.env` has:

```env
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

Then restart the backend (`Ctrl+C` and rerun `uvicorn`).

---

### Flutter — `flutter` command not found

Make sure `C:\flutter\bin` is in your PATH. Verify:

```powershell
$env:PATH -split ";" | Where-Object { $_ -like "*flutter*" }
```

If empty, add it:

```powershell
[Environment]::SetEnvironmentVariable(
    "PATH",
    [Environment]::GetEnvironmentVariable("PATH","Machine") + ";C:\flutter\bin",
    "Machine"
)
# Then close and reopen PowerShell
```

---

### Flutter app can't connect to backend (Android emulator)

`10.0.2.2` is the special Android emulator address pointing to your Windows host `localhost`. Make sure:
- Backend is running on port 8000
- Windows Firewall is not blocking port 8000

To allow port 8000 through Windows Firewall (run as Administrator):

```powershell
New-NetFirewallRule -DisplayName "Kavya Backend Dev" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

For a physical Android device on the same Wi-Fi:

```powershell
# Get your local IP
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like "Wi-Fi*" }).IPAddress

flutter run --dart-define=API_BASE_URL=http://YOUR_LOCAL_IP:8000/api/v1
```

---

### SSH permission error for .pem key on Windows

```powershell
# Fix permissions so only your user can read the file
icacls "$HOME\kavya-prod-key.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

---

### EC2 service not starting after deploy

```bash
# From your SSH session on EC2
sudo journalctl -u kavya-api --no-pager -n 50

# Most common causes:
# 1. Missing .env file
ls /var/www/kavya/backend/.env

# 2. Wrong Python path in service file
which python3.11
```

---

### RDS connection from EC2 timing out

Verify the RDS security group allows inbound port 5432 from the EC2 security group. Check in the AWS Console under **VPC → Security Groups**. The `aws_provision.sh` script sets this up, but confirm it is in place.

---

*Last updated: May 2026 — Windows Edition*
