from datetime import date
from pydantic import BaseModel
from typing import Optional


class TyreCreate(BaseModel):
    serial_number: Optional[str] = None
    manufacturer_serial: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    size: Optional[str] = None
    ply_rating: Optional[str] = None
    purchase_date: Optional[date] = None
    cost: Optional[float] = None
    vehicle_id: Optional[int] = None
    axle_position: Optional[str] = None
    status: str = 'new'
    tread_depth_mm: Optional[float] = None
    initial_tread_depth_mm: Optional[float] = None
    pressure_psi: Optional[float] = None
    quantity: int = 1


class TyreUpdate(BaseModel):
    serial_number: Optional[str] = None
    manufacturer_serial: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    purchase_date: Optional[date] = None
    cost: Optional[float] = None
    vehicle_id: Optional[int] = None
    axle_position: Optional[str] = None
    status: Optional[str] = None
    tread_depth_mm: Optional[float] = None
    pressure_psi: Optional[float] = None


class TyreEvent(BaseModel):
    event_type: str
    odometer: float
    reason: Optional[str] = None


class TyreRetreadRequest(BaseModel):
    vendor_name: Optional[str] = None
    cost: float
    odometer_km: Optional[float] = None
    notes: Optional[str] = None
