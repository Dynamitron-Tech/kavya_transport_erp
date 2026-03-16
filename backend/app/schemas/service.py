from datetime import date
from pydantic import BaseModel
from typing import Optional


class ServiceCreate(BaseModel):
    vehicle_id: int
    service_type: str
    service_date: date
    odometer: float
    workshop: str
    job_card_number: Optional[str] = None
    labour_cost: float = 0
    total_cost: float = 0
    next_service_km: Optional[float] = None
    next_service_date: Optional[date] = None
    notes: Optional[str] = None


class ServiceUpdate(BaseModel):
    vehicle_id: Optional[int] = None
    service_type: Optional[str] = None
    service_date: Optional[date] = None
    odometer: Optional[float] = None
    workshop: Optional[str] = None
    job_card_number: Optional[str] = None
    labour_cost: Optional[float] = None
    total_cost: Optional[float] = None
    next_service_km: Optional[float] = None
    next_service_date: Optional[date] = None
    notes: Optional[str] = None
