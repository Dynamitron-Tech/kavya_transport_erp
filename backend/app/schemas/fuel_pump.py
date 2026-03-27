# Fuel Pump Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# --- Depot Fuel Tank ---
class DepotFuelTankCreate(BaseModel):
    name: str = Field(..., max_length=100)
    fuel_type: str = "diesel"
    capacity_litres: Decimal
    current_stock_litres: Decimal = Decimal("0")
    min_stock_alert: Optional[Decimal] = None
    location: Optional[str] = None
    branch_id: Optional[int] = None


class DepotFuelTankUpdate(BaseModel):
    name: Optional[str] = None
    fuel_type: Optional[str] = None
    capacity_litres: Optional[Decimal] = None
    current_stock_litres: Optional[Decimal] = None
    min_stock_alert: Optional[Decimal] = None
    location: Optional[str] = None


class DepotFuelTankResponse(BaseModel):
    id: int
    name: str
    fuel_type: str
    capacity_litres: Decimal
    current_stock_litres: Decimal
    min_stock_alert: Optional[Decimal] = None
    location: Optional[str] = None
    branch_id: Optional[int] = None
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Fuel Issue ---
class FuelIssueCreate(BaseModel):
    tank_id: int
    vehicle_id: int
    driver_id: Optional[int] = None
    trip_id: Optional[int] = None
    fuel_type: str = "diesel"
    quantity_litres: Decimal = Field(..., gt=0)
    rate_per_litre: Decimal = Field(..., gt=0)
    odometer_reading: Optional[Decimal] = None
    issued_at: datetime
    receipt_number: Optional[str] = None
    remarks: Optional[str] = None


class FuelIssueResponse(BaseModel):
    id: int
    tank_id: int
    vehicle_id: int
    driver_id: Optional[int] = None
    trip_id: Optional[int] = None
    fuel_type: str
    quantity_litres: Decimal
    rate_per_litre: Decimal
    total_amount: Decimal
    odometer_reading: Optional[Decimal] = None
    issued_by: int
    issued_at: datetime
    receipt_number: Optional[str] = None
    remarks: Optional[str] = None
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    branch_id: Optional[int] = None
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None

    # Joined fields
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None
    tank_name: Optional[str] = None
    issuer_name: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Stock Transaction ---
class FuelStockTransactionCreate(BaseModel):
    tank_id: int
    transaction_type: str  # tanker_refill, manual_adjustment, loss
    quantity_litres: Decimal = Field(..., gt=0)
    rate_per_litre: Optional[Decimal] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None


class FuelStockTransactionResponse(BaseModel):
    id: int
    tank_id: int
    transaction_type: str
    quantity_litres: Decimal
    rate_per_litre: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    stock_before: Decimal
    stock_after: Decimal
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    created_by: int
    created_at: Optional[datetime] = None

    tank_name: Optional[str] = None
    creator_name: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Theft Alert ---
class FuelTheftAlertResponse(BaseModel):
    id: int
    fuel_issue_id: Optional[int] = None
    vehicle_id: int
    driver_id: Optional[int] = None
    alert_type: str
    severity: str
    description: str
    expected_litres: Optional[Decimal] = None
    actual_litres: Optional[Decimal] = None
    deviation_pct: Optional[Decimal] = None
    status: str
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: Optional[datetime] = None

    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None

    model_config = {"from_attributes": True}


class FuelTheftAlertResolve(BaseModel):
    status: str  # confirmed, false_alarm, resolved
    resolution_notes: Optional[str] = None


# --- Dashboard / Reports ---
class FuelDashboardStats(BaseModel):
    total_stock_litres: Decimal = Decimal("0")
    today_issued_litres: Decimal = Decimal("0")
    today_issued_count: int = 0
    month_issued_litres: Decimal = Decimal("0")
    month_cost: Decimal = Decimal("0")
    open_alerts: int = 0
    tanks: List[DepotFuelTankResponse] = []
