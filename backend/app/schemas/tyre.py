from datetime import date
from pydantic import BaseModel
from typing import Optional


class TyreCreate(BaseModel):
    serial_number: str
    brand: Optional[str] = None
    size: Optional[str] = None
    purchase_date: Optional[date] = None
    cost: Optional[float] = None
    vehicle_id: int
    axle_position: str
    status: str = 'MOUNTED'


class TyreUpdate(BaseModel):
    serial_number: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    purchase_date: Optional[date] = None
    cost: Optional[float] = None
    vehicle_id: Optional[int] = None
    axle_position: Optional[str] = None
    status: Optional[str] = None


class TyreEvent(BaseModel):
    event_type: str
    odometer: float
    reason: Optional[str] = None
