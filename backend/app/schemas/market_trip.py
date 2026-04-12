# Market Trip Schemas
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MarketTripCreate(BaseModel):
    job_id: Optional[int] = None
    supplier_id: Optional[int] = None
    # Vehicle
    vehicle_registration: Optional[str] = None
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    owner_name: Optional[str] = None
    rc_issue_date: Optional[str] = None
    rc_validity_date: Optional[str] = None
    rc_file_url: Optional[str] = None
    # Driver
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_alt_phone: Optional[str] = None
    driver_address: Optional[str] = None
    driver_license: Optional[str] = None
    driver_license_issue: Optional[str] = None
    driver_license_valid: Optional[str] = None
    dl_file_url: Optional[str] = None
    # Rates
    client_rate: float = 0.0
    contractor_rate: float = 0.0
    advance_amount: float = 0
    loading_charges: float = 0
    unloading_charges: float = 0
    other_charges: float = 0
    tds_rate: float = 1.0


class MarketTripUpdate(BaseModel):
    # Vehicle
    vehicle_registration: Optional[str] = None
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    rc_file_url: Optional[str] = None
    # Driver
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_alt_phone: Optional[str] = None
    driver_address: Optional[str] = None
    driver_license: Optional[str] = None
    driver_license_issue: Optional[str] = None
    driver_license_valid: Optional[str] = None
    dl_file_url: Optional[str] = None
    # Rates
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
