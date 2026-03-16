# API v1 Router - All endpoint registrations
# Transport ERP

from fastapi import APIRouter

from app.api.v1.endpoints import (
    aliases,
    compat,
    admin,
    auth,
    users,
    clients,
    vehicles,
    drivers,
    jobs,
    lr,
    eway_bill,
    trips,
    finance,
    tracking,
    reports,
    dashboard,
    documents,
    fleet_manager,
    accountant,
    tyre,
    service,
    vahan,
    sarathi,
    echallan,
    gst,
    payments,
    notifications,
    fuel,
    maps,
)

api_router = APIRouter()

# Compatibility routes (must be first to avoid dynamic /{id} route collisions)
api_router.include_router(compat.router, tags=["Compatibility"])
api_router.include_router(aliases.router, tags=["Aliases"])

# Authentication
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# User Management
api_router.include_router(users.router, prefix="/users", tags=["Users"])

# Admin
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])

# Core Business Modules
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(lr.router, prefix="/lr", tags=["Lorry Receipts"])
api_router.include_router(eway_bill.router, prefix="/eway-bills", tags=["E-way Bills"])
api_router.include_router(trips.router, prefix="/trips", tags=["Trips"])

# Finance
api_router.include_router(finance.router, prefix="/finance", tags=["Finance"])

# Tracking & Monitoring
api_router.include_router(tracking.router, prefix="/tracking", tags=["Tracking"])

# Document Management
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])

# Reports & Dashboard
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

# Fleet Manager
api_router.include_router(fleet_manager.router, prefix="/fleet", tags=["Fleet Manager"])
api_router.include_router(tyre.router, prefix="/tyre", tags=["Tyre"])
api_router.include_router(service.router, prefix="/service", tags=["Service"])

# Accountant
api_router.include_router(accountant.router, prefix="/accountant", tags=["Accountant"])

# Government API Integrations
api_router.include_router(vahan.router, prefix="/vahan", tags=["VAHAN"])
api_router.include_router(sarathi.router, prefix="/sarathi", tags=["Sarathi"])
api_router.include_router(echallan.router, prefix="/echallan", tags=["eChallan"])
api_router.include_router(gst.router, prefix="/gst", tags=["GST"])

# Maps & Routing
api_router.include_router(maps.router, prefix="/maps", tags=["Maps"])

# Payments
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])

# Notifications
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# Fuel Prices
api_router.include_router(fuel.router, prefix="/fuel-prices", tags=["Fuel Prices"])
