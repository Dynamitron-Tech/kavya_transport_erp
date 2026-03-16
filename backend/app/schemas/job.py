# Job Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class JobCreate(BaseModel):
    job_date: date
    client_id: int
    client_ref_number: Optional[str] = None
    origin_address: str
    origin_city: str
    origin_state: Optional[str] = None
    origin_pincode: Optional[str] = None
    destination_address: str
    destination_city: str
    destination_state: Optional[str] = None
    destination_pincode: Optional[str] = None
    route_id: Optional[int] = None
    estimated_distance_km: Optional[float] = None
    contract_type: str = "spot"
    priority: str = "normal"
    material_type: Optional[str] = None
    material_description: Optional[str] = None
    quantity: Optional[float] = None
    quantity_unit: Optional[str] = None
    declared_value: Optional[float] = None
    is_hazardous: bool = False
    vehicle_type_required: Optional[str] = None
    num_vehicles_required: int = 1
    special_requirements: Optional[str] = None
    pickup_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    rate_type: str = "per_trip"
    agreed_rate: Optional[float] = None
    loading_charges: float = 0
    unloading_charges: float = 0
    other_charges: float = 0


class JobUpdate(BaseModel):
    client_ref_number: Optional[str] = None
    origin_address: Optional[str] = None
    origin_city: Optional[str] = None
    destination_address: Optional[str] = None
    destination_city: Optional[str] = None
    route_id: Optional[int] = None
    estimated_distance_km: Optional[float] = None
    contract_type: Optional[str] = None
    priority: Optional[str] = None
    material_type: Optional[str] = None
    quantity: Optional[float] = None
    vehicle_type_required: Optional[str] = None
    pickup_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    rate_type: Optional[str] = None
    agreed_rate: Optional[float] = None
    loading_charges: Optional[float] = None
    unloading_charges: Optional[float] = None
    other_charges: Optional[float] = None
    special_requirements: Optional[str] = None


class JobResponse(BaseModel):
    id: int
    job_number: str
    job_date: date
    client_id: int
    client_name: Optional[str] = None
    client_ref_number: Optional[str] = None
    origin_city: str
    origin_state: Optional[str] = None
    destination_city: str
    destination_state: Optional[str] = None
    route_id: Optional[int] = None
    estimated_distance_km: Optional[float] = None
    contract_type: Optional[str] = None
    priority: Optional[str] = None
    material_type: Optional[str] = None
    quantity: Optional[float] = None
    quantity_unit: Optional[str] = None
    vehicle_type_required: Optional[str] = None
    num_vehicles_required: int = 1
    pickup_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    rate_type: str = "per_trip"
    agreed_rate: Optional[float] = None
    total_amount: Optional[float] = None
    status: str = "draft"
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    lr_count: int = 0
    trip_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobStatusChange(BaseModel):
    status: str
    remarks: Optional[str] = None
