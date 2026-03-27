# Market Trip Schemas
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MarketTripCreate(BaseModel):
    job_id: int
    supplier_id: int
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_license: Optional[str] = None
    client_rate: float
    contractor_rate: float
    advance_amount: float = 0
    loading_charges: float = 0
    unloading_charges: float = 0
    other_charges: float = 0
    tds_rate: float = 1.0


class MarketTripUpdate(BaseModel):
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_license: Optional[str] = None
    contractor_rate: Optional[float] = None
    advance_amount: Optional[float] = None
    loading_charges: Optional[float] = None
    unloading_charges: Optional[float] = None
    other_charges: Optional[float] = None
    tds_rate: Optional[float] = None


class MarketTripAssign(BaseModel):
    vehicle_registration: str
    driver_name: str
    driver_phone: str
    driver_license: Optional[str] = None


class MarketTripSettle(BaseModel):
    settlement_reference: str
    settlement_remarks: Optional[str] = None
