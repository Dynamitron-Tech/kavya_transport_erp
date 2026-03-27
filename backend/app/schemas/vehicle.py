# Vehicle Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class VehicleCreate(BaseModel):
    registration_number: str = Field(..., min_length=1, max_length=20)
    vehicle_type: str = "truck"
    make: Optional[str] = None
    model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    capacity_tons: Optional[float] = None
    capacity_volume: Optional[float] = None
    num_axles: int = 2
    num_tyres: Optional[int] = None
    ownership_type: str = "owned"
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    fuel_type: str = "diesel"
    fuel_tank_capacity: Optional[float] = None
    mileage_per_litre: Optional[float] = None
    odometer_reading: Optional[float] = None
    gps_device_id: Optional[str] = None
    gps_provider: Optional[str] = None
    fitness_valid_until: Optional[date] = None
    permit_valid_until: Optional[date] = None
    insurance_valid_until: Optional[date] = None
    puc_valid_until: Optional[date] = None


class VehicleUpdate(BaseModel):
    vehicle_type: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    capacity_tons: Optional[float] = None
    ownership_type: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    fuel_tank_capacity: Optional[float] = None
    gps_device_id: Optional[str] = None
    fitness_valid_until: Optional[date] = None
    permit_valid_until: Optional[date] = None
    insurance_valid_until: Optional[date] = None
    puc_valid_until: Optional[date] = None
    status: Optional[str] = None
    odometer_reading: Optional[float] = None


class VehicleResponse(BaseModel):
    id: int
    registration_number: str
    vehicle_type: str
    make: Optional[str] = None
    model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    capacity_tons: Optional[float] = None
    num_tyres: Optional[int] = None
    ownership_type: str = "owned"
    owner_name: Optional[str] = None
    status: str = "available"
    current_location: Optional[str] = None
    odometer_reading: float = 0
    fuel_type: str = "diesel"
    gps_device_id: Optional[str] = None
    fitness_valid_until: Optional[date] = None
    permit_valid_until: Optional[date] = None
    insurance_valid_until: Optional[date] = None
    puc_valid_until: Optional[date] = None
    expiry_alerts: List[dict] = []
    days_to_nearest_expiry: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
