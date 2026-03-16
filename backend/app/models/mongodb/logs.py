# MongoDB Log Models - Audit, Notifications, Alerts
# Transport ERP - Flexible Schema Logs

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


class AuditLog(BaseModel):
    """
    Audit trail for all system actions.
    Collection: audit_logs
    - Immutable once written
    - Indexed by entity_type, entity_id, user_id, timestamp
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Timestamp
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # User who performed action
    user_id: int
    user_email: str
    user_name: str
    user_role: str
    
    # Action
    action: str  # create, update, delete, approve, reject, login, logout, export
    
    # Entity
    entity_type: str  # client, job, trip, invoice, etc.
    entity_id: Optional[int] = None
    entity_identifier: Optional[str] = None  # e.g., trip_number, invoice_number
    
    # Changes (for update actions)
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    changes: Optional[List[str]] = None  # List of changed field names
    
    # Request context
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    
    # Additional context
    remarks: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class NotificationLog(BaseModel):
    """
    Notification history and delivery status.
    Collection: notification_logs
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    
    # Recipient
    user_id: int
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    
    # Notification content
    notification_type: str  # email, sms, push, in_app
    category: str  # trip_start, trip_complete, payment, alert, reminder
    
    title: str
    message: str
    
    # Delivery
    channel: str  # smtp, twilio, fcm, etc.
    status: str = "pending"  # pending, sent, delivered, failed, read
    failure_reason: Optional[str] = None
    retry_count: int = 0
    
    # Reference
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    
    # Read tracking
    is_read: bool = False
    read_at: Optional[datetime] = None
    
    # Action URL (for clickable notifications)
    action_url: Optional[str] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class AlertLog(BaseModel):
    """
    System alerts (vehicle alerts, trip alerts, etc.).
    Collection: alert_logs
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Timestamp
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Alert details
    alert_type: str  # overspeed, geofence_breach, sos, low_fuel, idle, deviation, maintenance_due
    severity: str  # info, warning, critical
    
    title: str
    message: str
    
    # Entity
    entity_type: str  # vehicle, driver, trip
    entity_id: int
    entity_identifier: str  # vehicle_number, driver_code, trip_number
    
    # Location (if applicable)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    
    # Context data
    context: Dict[str, Any] = {}  # e.g., {"speed": 120, "limit": 80}
    
    # Status
    status: str = "active"  # active, acknowledged, resolved, ignored
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    
    # Notifications sent
    notifications_sent: List[str] = []  # list of notification IDs
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DriverChecklistLog(BaseModel):
    """
    Daily driver checklists and pre-trip inspections.
    Collection: driver_checklist_logs
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Timestamp
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Driver & Vehicle
    driver_id: int
    driver_name: str
    vehicle_id: int
    vehicle_number: str
    
    # Trip (if pre-trip checklist)
    trip_id: Optional[int] = None
    trip_number: Optional[str] = None
    
    # Checklist type
    checklist_type: str  # pre_trip, post_trip, daily, weekly
    
    # Location
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    
    # Checklist items
    items: List[Dict[str, Any]] = []
    # Each item: {
    #   "category": "tyres",
    #   "item": "Front left tyre pressure",
    #   "status": "ok" | "issue" | "na",
    #   "value": "32 psi",
    #   "remarks": "Minor wear",
    #   "photo_url": "..."
    # }
    
    # Summary
    total_items: int = 0
    ok_count: int = 0
    issue_count: int = 0
    na_count: int = 0
    
    # Overall status
    overall_status: str = "passed"  # passed, failed, attention_needed
    
    # Photos
    photos: List[Dict[str, str]] = []  # [{"category": "front", "url": "..."}]
    
    # Signatures
    driver_signature_url: Optional[str] = None
    supervisor_signature_url: Optional[str] = None
    
    # Remarks
    remarks: Optional[str] = None
    
    # Review
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_remarks: Optional[str] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DriverAttendanceLog(BaseModel):
    """
    Detailed driver attendance with GPS location.
    Collection: driver_attendance_logs
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Driver
    driver_id: int
    driver_name: str
    employee_code: str
    
    # Date
    date: str  # YYYY-MM-DD
    
    # Check-in
    check_in_time: Optional[datetime] = None
    check_in_latitude: Optional[float] = None
    check_in_longitude: Optional[float] = None
    check_in_location: Optional[str] = None
    check_in_photo_url: Optional[str] = None
    check_in_device_info: Optional[Dict[str, Any]] = None
    
    # Check-out
    check_out_time: Optional[datetime] = None
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None
    check_out_location: Optional[str] = None
    check_out_photo_url: Optional[str] = None
    
    # Working hours
    total_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    
    # Status
    status: str = "present"  # present, absent, half_day, leave, on_trip
    
    # Leave details (if on leave)
    leave_type: Optional[str] = None
    leave_reason: Optional[str] = None
    
    # Trip details (if on trip)
    trip_id: Optional[int] = None
    trip_number: Optional[str] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
