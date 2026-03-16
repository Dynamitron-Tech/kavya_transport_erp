# MongoDB Analytics Models - Reports, AI Insights
# Transport ERP - Analytics & Reporting Data

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
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


class AnalyticsSnapshot(BaseModel):
    """
    Pre-computed analytics snapshots for dashboard.
    Collection: analytics_snapshots
    - Generated periodically (hourly/daily)
    - Fast read for dashboards
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Snapshot details
    snapshot_type: str  # daily, weekly, monthly, yearly
    snapshot_date: str  # YYYY-MM-DD
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Scope
    scope: str = "company"  # company, branch, fleet_manager
    scope_id: Optional[int] = None  # branch_id or user_id if scoped
    
    # Fleet Overview
    fleet_stats: Dict[str, Any] = {
        "total_vehicles": 0,
        "available": 0,
        "on_trip": 0,
        "maintenance": 0,
        "breakdown": 0,
    }
    
    # Trip Metrics
    trip_stats: Dict[str, Any] = {
        "total_trips": 0,
        "completed": 0,
        "in_progress": 0,
        "cancelled": 0,
        "total_distance_km": 0,
        "avg_trip_duration_hours": 0,
    }
    
    # Financial Summary
    financial_stats: Dict[str, Any] = {
        "total_revenue": 0,
        "total_expenses": 0,
        "gross_profit": 0,
        "profit_margin_percent": 0,
        "outstanding_receivables": 0,
        "outstanding_payables": 0,
    }
    
    # Fuel Analytics
    fuel_stats: Dict[str, Any] = {
        "total_fuel_litres": 0,
        "total_fuel_cost": 0,
        "avg_mileage_kmpl": 0,
        "fuel_efficiency_trend": "stable",  # improving, stable, declining
    }
    
    # Driver Performance
    driver_stats: Dict[str, Any] = {
        "total_drivers": 0,
        "available": 0,
        "on_trip": 0,
        "avg_trips_per_driver": 0,
        "top_performers": [],  # [{"driver_id": 1, "name": "...", "score": 95}]
    }
    
    # Alerts Summary
    alert_stats: Dict[str, Any] = {
        "total_alerts": 0,
        "critical": 0,
        "warnings": 0,
        "resolved": 0,
        "pending": 0,
    }
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class ReportCache(BaseModel):
    """
    Cached generated reports for faster access.
    Collection: report_cache
    - TTL index for automatic expiry
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Report identification
    report_type: str  # trip_summary, profit_loss, fuel_analysis, etc.
    report_name: str
    
    # Parameters used to generate
    parameters: Dict[str, Any] = {}  # date range, filters, etc.
    parameters_hash: str  # Hash of parameters for quick lookup
    
    # Generated data
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    
    # Report data
    data: Dict[str, Any] = {}
    
    # File (if PDF/Excel generated)
    file_url: Optional[str] = None
    file_type: Optional[str] = None  # pdf, xlsx, csv
    
    # Generation info
    generated_by: Optional[int] = None
    generation_time_seconds: Optional[float] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class AIInsight(BaseModel):
    """
    AI-generated insights and anomaly detection results.
    Collection: ai_insights
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Timestamp
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    valid_until: datetime
    
    # Insight type
    insight_type: str  # anomaly, prediction, recommendation, trend
    category: str  # fuel, maintenance, route, driver, finance
    
    # Priority
    priority: str = "medium"  # low, medium, high, critical
    
    # Content
    title: str
    description: str
    detailed_analysis: Optional[str] = None
    
    # Related entities
    entities: List[Dict[str, Any]] = []
    # Each: {"type": "vehicle", "id": 1, "identifier": "TN01AB1234"}
    
    # Data points
    data_points: Dict[str, Any] = {}
    
    # Recommendations
    recommendations: List[str] = []
    
    # Impact
    potential_impact: Optional[str] = None  # e.g., "Cost saving of ₹50,000/month"
    confidence_score: Optional[float] = None  # 0-100
    
    # Status
    status: str = "active"  # active, acknowledged, acted_upon, dismissed
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    action_taken: Optional[str] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VehicleHealthScore(BaseModel):
    """
    Vehicle health scoring based on telemetry and maintenance.
    Collection: vehicle_health_scores
    - Updated daily
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    vehicle_id: int
    vehicle_number: str
    
    score_date: str  # YYYY-MM-DD
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall score (0-100)
    overall_score: float
    health_status: str  # excellent, good, fair, poor, critical
    
    # Component scores
    engine_score: float = 100
    tyre_score: float = 100
    brake_score: float = 100
    fuel_efficiency_score: float = 100
    maintenance_compliance_score: float = 100
    
    # Metrics
    metrics: Dict[str, Any] = {
        "total_km": 0,
        "avg_fuel_efficiency": 0,
        "dtc_codes_count": 0,
        "overdue_maintenance_count": 0,
        "breakdown_count_last_30_days": 0,
    }
    
    # Warnings
    warnings: List[str] = []
    
    # Predicted issues
    predicted_issues: List[Dict[str, Any]] = []
    # Each: {"issue": "Tyre replacement due", "probability": 0.85, "timeframe": "7 days"}
    
    # Trend
    score_trend: str = "stable"  # improving, stable, declining
    previous_score: Optional[float] = None
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DriverPerformanceScore(BaseModel):
    """
    Driver performance scoring.
    Collection: driver_performance_scores
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    driver_id: int
    driver_name: str
    employee_code: str
    
    score_period: str  # YYYY-MM (monthly) or YYYY-WW (weekly)
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Overall score (0-100)
    overall_score: float
    performance_tier: str  # star, good, average, below_average, poor
    
    # Component scores
    safety_score: float = 100  # Based on overspeeding, harsh braking etc.
    punctuality_score: float = 100  # On-time delivery
    fuel_efficiency_score: float = 100  # Actual vs expected mileage
    compliance_score: float = 100  # Checklist, document compliance
    attendance_score: float = 100
    
    # Metrics
    metrics: Dict[str, Any] = {
        "trips_completed": 0,
        "total_km_driven": 0,
        "on_time_deliveries": 0,
        "late_deliveries": 0,
        "overspeeding_incidents": 0,
        "harsh_braking_count": 0,
        "attendance_percent": 100,
        "fuel_efficiency_kmpl": 0,
    }
    
    # Awards/Penalties
    awards: List[str] = []
    penalties: List[str] = []
    
    # Trend
    score_trend: str = "stable"
    previous_score: Optional[float] = None
    
    # Multi-tenant  
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class RouteAnalytics(BaseModel):
    """
    Route-wise analytics for optimization.
    Collection: route_analytics
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    route_id: int
    route_code: str
    origin: str
    destination: str
    
    analytics_period: str  # YYYY-MM
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Trip stats
    total_trips: int = 0
    successful_trips: int = 0
    delayed_trips: int = 0
    
    # Distance
    planned_distance_km: float
    avg_actual_distance_km: float
    distance_variance_percent: float = 0
    
    # Time
    estimated_hours: float
    avg_actual_hours: float
    time_variance_percent: float = 0
    
    # Fuel
    budgeted_fuel_litres: float = 0
    avg_actual_fuel_litres: float = 0
    fuel_variance_percent: float = 0
    
    # Cost
    budgeted_cost: float = 0
    avg_actual_cost: float = 0
    cost_variance_percent: float = 0
    
    # Revenue
    avg_revenue: float = 0
    avg_profit: float = 0
    profit_margin_percent: float = 0
    
    # Issues
    common_issues: List[Dict[str, Any]] = []
    # Each: {"issue": "Traffic delay at X", "frequency": 15}
    
    # Recommendations
    optimization_recommendations: List[str] = []
    
    # Multi-tenant
    tenant_id: Optional[int] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
