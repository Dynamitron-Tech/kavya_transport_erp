# Trip Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class TripExpenseCreate(BaseModel):
    category: str  # fuel, toll, food, parking, loading, etc.
    sub_category: Optional[str] = None
    description: Optional[str] = None
    amount: float
    payment_mode: str = "cash"
    reference_number: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    receipt_url: Optional[str] = None
    receipt_number: Optional[str] = None
    expense_date: datetime
    biometric_verified: bool = False


class TripExpenseResponse(BaseModel):
    id: int
    trip_id: int
    category: str
    sub_category: Optional[str] = None
    description: Optional[str] = None
    amount: float
    payment_mode: str = "cash"
    reference_number: Optional[str] = None
    location: Optional[str] = None
    receipt_url: Optional[str] = None
    is_verified: bool = False
    verified_by: Optional[int] = None
    expense_date: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TripFuelCreate(BaseModel):
    fuel_date: datetime
    fuel_type: str = "diesel"
    quantity_litres: float
    rate_per_litre: float
    total_amount: float
    odometer_reading: Optional[float] = None
    pump_name: Optional[str] = None
    pump_location: Optional[str] = None
    bill_number: Optional[str] = None
    bill_url: Optional[str] = None
    payment_mode: str = "fuel_card"
    fuel_card_number: Optional[str] = None


class TripFuelResponse(BaseModel):
    id: int
    trip_id: int
    vehicle_id: int
    fuel_date: datetime
    fuel_type: str
    quantity_litres: float
    rate_per_litre: float
    total_amount: float
    odometer_reading: Optional[float] = None
    pump_name: Optional[str] = None
    pump_location: Optional[str] = None
    bill_number: Optional[str] = None
    is_verified: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TripCreate(BaseModel):
    trip_date: date
    job_id: int
    vehicle_id: int
    driver_id: int
    helper_id: Optional[int] = None
    route_id: Optional[int] = None
    origin: str
    destination: str
    planned_distance_km: Optional[float] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    estimated_fuel_litres: Optional[float] = None
    driver_advance: float = 0
    driver_pay: float = 0
    lr_ids: List[int] = []
    remarks: Optional[str] = None


class TripUpdate(BaseModel):
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None
    helper_id: Optional[int] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    estimated_fuel_litres: Optional[float] = None
    driver_advance: Optional[float] = None
    driver_pay: Optional[float] = None
    remarks: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    trip_number: str
    trip_date: date
    job_id: int
    job_number: Optional[str] = None
    vehicle_id: int
    vehicle_registration: Optional[str] = None
    driver_id: int
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    helper_id: Optional[int] = None
    route_id: Optional[int] = None
    origin: str
    destination: str
    planned_distance_km: Optional[float] = None
    actual_distance_km: Optional[float] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    start_odometer: Optional[float] = None
    end_odometer: Optional[float] = None
    status: str = "planned"
    fuel_cost: float = 0
    total_expense: float = 0
    revenue: float = 0
    profit_loss: float = 0
    driver_advance: float = 0
    driver_pay: float = 0
    advance_settled: bool = False
    pod_collected: bool = False
    expenses_verified: bool = False
    is_invoiced: bool = False
    lr_count: int = 0
    expense_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TripStatusChange(BaseModel):
    status: str
    remarks: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    odometer_reading: Optional[float] = None
