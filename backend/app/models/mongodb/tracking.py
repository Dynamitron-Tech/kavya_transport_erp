# MongoDB Tracking Models - GPS, Telemetry
# Transport ERP - High Volume Real-time Data

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId for Pydantic compatibility."""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)
    
    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


class GPSTrackingPoint(BaseModel):
    """Individual GPS tracking point - stored as embedded document in TripTrackingDocument."""
    
    timestamp: datetime
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None  # km/h
    heading: Optional[float] = None  # degrees 0-360
    accuracy: Optional[float] = None  # meters
    
    # Geofence
    in_geofence: Optional[bool] = None
    geofence_name: Optional[str] = None
    
    # Address (reverse geocoded)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class TripTrackingDocument(BaseModel):
    """
    Full trip tracking document with GPS trail.
    Collection: trip_tracking
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # References (PostgreSQL IDs)
    trip_id: int
    trip_number: str
    vehicle_id: int
    vehicle_number: str
    driver_id: int
    driver_name: str
    
    # Trip Info
    origin: str
    destination: str
    planned_distance_km: Optional[float] = None
    
    # Timing
    tracking_started_at: Optional[datetime] = None
    tracking_ended_at: Optional[datetime] = None
    
    # GPS Trail - Array of tracking points
    gps_trail: List[GPSTrackingPoint] = []
    
    # Summary Stats (updated periodically)
    total_distance_km: Optional[float] = 0
    max_speed: Optional[float] = 0
    avg_speed: Optional[float] = 0
    total_stoppage_time_mins: Optional[int] = 0
    total_idle_time_mins: Optional[int] = 0
    
    # Alerts during trip
    overspeeding_count: int = 0
    harsh_braking_count: int = 0
    harsh_acceleration_count: int = 0
    route_deviation_count: int = 0
    
    # Status
    is_active: bool = True
    
    # Tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VehicleTelemetry(BaseModel):
    """
    Real-time vehicle telemetry data from OBD/GPS devices.
    Collection: vehicle_telemetry
    - High frequency writes
    - TTL index for automatic cleanup (retain 30 days)
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Vehicle reference
    vehicle_id: int
    vehicle_number: str
    gps_device_id: Optional[str] = None
    
    # Timestamp
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Location
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: float = 0  # km/h
    heading: Optional[float] = None
    
    # Engine Data (OBD)
    engine_on: bool = False
    rpm: Optional[int] = None
    engine_load: Optional[float] = None  # percentage
    coolant_temp: Optional[float] = None  # celsius
    fuel_level: Optional[float] = None  # percentage
    fuel_rate: Optional[float] = None  # litres/hour
    
    # Battery
    battery_voltage: Optional[float] = None
    
    # Driving Behavior
    is_idling: bool = False
    is_overspeeding: bool = False
    harsh_braking: bool = False
    harsh_acceleration: bool = False
    
    # Active Trip (if any)
    trip_id: Optional[int] = None
    
    # Alert flags
    alerts: List[str] = []  # e.g., ["low_fuel", "overspeed", "engine_warning"]
    
    # Tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class FuelSensorLog(BaseModel):
    """
    Raw fuel sensor readings for fuel monitoring.
    Collection: fuel_sensor_logs
    - Very high frequency for theft detection
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    vehicle_id: int
    vehicle_number: str
    sensor_id: Optional[str] = None
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Fuel readings
    fuel_level_percentage: float
    fuel_level_litres: Optional[float] = None
    tank_capacity: Optional[float] = None
    
    # Location at reading
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Events
    is_refueling: bool = False
    is_draining: bool = False  # Possible theft
    level_change: Optional[float] = None  # Difference from last reading
    
    # Trip reference
    trip_id: Optional[int] = None
    
    # Tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class EngineLog(BaseModel):
    """
    Engine diagnostic logs from OBD.
    Collection: engine_logs
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    vehicle_id: int
    vehicle_number: str
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # OBD Data
    dtc_codes: List[str] = []  # Diagnostic Trouble Codes
    mil_status: bool = False  # Malfunction Indicator Light
    
    # Engine metrics
    engine_runtime_seconds: Optional[int] = None
    odometer: Optional[float] = None
    
    # PIDs data (raw)
    pid_data: dict = {}
    
    # Severity
    severity: str = "info"  # info, warning, critical
    
    # Tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
