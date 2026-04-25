from datetime import date
from pydantic import BaseModel
from typing import Optional


class ServiceCreate(BaseModel):
    vehicle_id: int
    service_type: str
    service_date: date
    odometer: float
    workshop: str
    workshop_id: Optional[int] = None
    job_card_number: Optional[str] = None
    work_order_number: Optional[str] = None
    parts_description: Optional[str] = None
    labour_cost: float = 0
    parts_cost: float = 0
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
    workshop_id: Optional[int] = None
    job_card_number: Optional[str] = None
    work_order_number: Optional[str] = None
    parts_description: Optional[str] = None
    labour_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_cost: Optional[float] = None
    next_service_km: Optional[float] = None
    next_service_date: Optional[date] = None
    notes: Optional[str] = None


class WorkshopCreate(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    rating: Optional[float] = None
    is_empanelled: bool = True


class WorkshopUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    rating: Optional[float] = None
    is_empanelled: Optional[bool] = None
