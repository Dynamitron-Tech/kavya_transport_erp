from logging.config import fileConfig
import sys
from pathlib import Path

from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool

from alembic import context

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import settings and models
from app.core.config import settings
from app.models.postgres.base import Base
from app.models.postgres.user import User, Role, Permission, RolePermission, UserRole, Branch, Tenant
from app.models.postgres.client import Client, ClientContact
from app.models.postgres.vehicle import Vehicle, VehicleDocument, VehicleMaintenance
from app.models.postgres.driver import Driver, DriverDocument, DriverLicense, DriverAttendance
from app.models.postgres.job import Job, JobStatus, JobType
from app.models.postgres.lr import LR, LRItem, LRDocument
from app.models.postgres.trip import Trip, TripExpense, TripFuelEntry, TripStatus
from app.models.postgres.finance import Invoice, InvoiceItem, Payment, Ledger, GSTEntry, Vendor, Receivable, Payable
from app.models.postgres.finance_automation import (
    PaymentLink, BankStatement, BankStatementLine, DriverSettlement,
    SupplierPayable, FASTagTransaction, FinanceAlert, FinanceReportCache,
)
from app.models.postgres.route import Route, RouteBudget, RateChart, FuelPrice, BankAccount, BankTransaction
from app.models.postgres.eway_bill import EwayBill, EwayItem
from app.models.postgres.document import Document, DocumentVersion
from app.models.postgres.fuel_pump import DepotFuelTank, FuelIssue, FuelStockTransaction, FuelTheftAlert
from app.models.postgres.supplier import Supplier, SupplierVehicle
from app.models.postgres.market_trip import MarketTrip
from app.models.postgres.geofence import Geofence, GeofenceType
from app.models.postgres.compliance_alert import ComplianceAlert, AlertType, AlertSeverity
from app.models.postgres.driver_event import DriverEvent, DriverEventType
from app.models.postgres.audit_note import AuditNote, AuditNoteStatus

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Use database URL from our app settings (sync version)
DATABASE_URL = settings.POSTGRES_URL_SYNC

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata to our models
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
