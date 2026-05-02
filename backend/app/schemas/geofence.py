# Geofence Schemas
# Transport ERP — Phase B

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PointSchema(BaseModel):
    lat: float
    lng: float


class GeofenceCreate(BaseModel):
    name: str
    geofence_type: str = "zone"
    trip_id: Optional[int] = None
    route_id: Optional[int] = None
    polygon: Optional[List[PointSchema]] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_meters: Optional[float] = None
    alert_threshold_meters: float = 500
    speed_limit_kmph: Optional[float] = None


class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    geofence_type: Optional[str] = None
    polygon: Optional[List[PointSchema]] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_meters: Optional[float] = None
    alert_threshold_meters: Optional[float] = None
    speed_limit_kmph: Optional[float] = None
    is_active: Optional[bool] = None


class GeofenceCheckRequest(BaseModel):
    lat: float
    lng: float
    vehicle_id: Optional[int] = None


class DriverEventCreate(BaseModel):
    driver_id: int
    trip_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    event_type: str
    severity: int = 1
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    speed_kmph: Optional[float] = None
    details: Optional[dict] = None


class AuditNoteCreate(BaseModel):
    resource_type: str
    resource_id: int
    note_text: str


class ComplianceAlertResolve(BaseModel):
    notes: Optional[str] = None
