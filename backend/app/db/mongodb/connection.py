# MongoDB Database Connection
# Transport ERP - Motor Async Driver

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING, GEOSPHERE
from typing import Optional
from datetime import datetime, timedelta

from app.core.config import settings


class MongoDB:
    """MongoDB connection manager."""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect(cls):
        """Connect to MongoDB."""
        cls.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        cls.db = cls.client[settings.MONGODB_DB]
        
        # Create indexes
        await cls.create_indexes()
        
        print(f"Connected to MongoDB: {settings.MONGODB_DB}")
    
    @classmethod
    async def disconnect(cls):
        """Disconnect from MongoDB."""
        if cls.client:
            cls.client.close()
            print("Disconnected from MongoDB")
    
    @classmethod
    async def create_indexes(cls):
        """Create indexes for all collections."""
        
        # Trip Tracking indexes
        await cls.db.trip_tracking.create_indexes([
            IndexModel([("trip_id", ASCENDING)], unique=True),
            IndexModel([("trip_number", ASCENDING)]),
            IndexModel([("vehicle_id", ASCENDING)]),
            IndexModel([("driver_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tracking_started_at", DESCENDING)]),
            IndexModel([("is_active", ASCENDING)]),
        ])
        
        # Vehicle Telemetry indexes (with TTL)
        await cls.db.vehicle_telemetry.create_indexes([
            IndexModel([("vehicle_id", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("trip_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel(
                [("timestamp", ASCENDING)],
                expireAfterSeconds=30 * 24 * 60 * 60  # 30 days TTL
            ),
            # Geospatial index for location queries
            IndexModel([("location", GEOSPHERE)], sparse=True),
        ])
        
        # Fuel Sensor Logs (with TTL)
        await cls.db.fuel_sensor_logs.create_indexes([
            IndexModel([("vehicle_id", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("trip_id", ASCENDING)]),
            IndexModel([("is_refueling", ASCENDING)]),
            IndexModel([("is_draining", ASCENDING)]),
            IndexModel(
                [("timestamp", ASCENDING)],
                expireAfterSeconds=90 * 24 * 60 * 60  # 90 days TTL
            ),
        ])
        
        # Audit Logs indexes
        await cls.db.audit_logs.create_indexes([
            IndexModel([("user_id", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("entity_type", ASCENDING), ("entity_id", ASCENDING)]),
            IndexModel([("action", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("timestamp", DESCENDING)]),
            IndexModel([("timestamp", DESCENDING)]),
        ])
        
        # Notification Logs indexes
        await cls.db.notification_logs.create_indexes([
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("is_read", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
        ])
        
        # Alert Logs indexes
        await cls.db.alert_logs.create_indexes([
            IndexModel([("entity_type", ASCENDING), ("entity_id", ASCENDING)]),
            IndexModel([("alert_type", ASCENDING)]),
            IndexModel([("severity", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("timestamp", DESCENDING)]),
        ])
        
        # Driver Checklist Logs indexes
        await cls.db.driver_checklist_logs.create_indexes([
            IndexModel([("driver_id", ASCENDING), ("submitted_at", DESCENDING)]),
            IndexModel([("vehicle_id", ASCENDING)]),
            IndexModel([("trip_id", ASCENDING)]),
            IndexModel([("overall_status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
        ])
        
        # Analytics Snapshots indexes
        await cls.db.analytics_snapshots.create_indexes([
            IndexModel([("snapshot_type", ASCENDING), ("snapshot_date", DESCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("scope", ASCENDING)]),
        ])
        
        # Report Cache indexes (with TTL)
        await cls.db.report_cache.create_indexes([
            IndexModel([("report_type", ASCENDING), ("parameters_hash", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel(
                [("expires_at", ASCENDING)],
                expireAfterSeconds=0  # TTL based on expires_at field
            ),
        ])
        
        # AI Insights indexes
        await cls.db.ai_insights.create_indexes([
            IndexModel([("insight_type", ASCENDING), ("category", ASCENDING)]),
            IndexModel([("priority", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("generated_at", DESCENDING)]),
        ])
        
        # Vehicle Health Scores indexes
        await cls.db.vehicle_health_scores.create_indexes([
            IndexModel([("vehicle_id", ASCENDING), ("score_date", DESCENDING)]),
            IndexModel([("health_status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
        ])
        
        # Driver Performance Scores indexes
        await cls.db.driver_performance_scores.create_indexes([
            IndexModel([("driver_id", ASCENDING), ("score_period", DESCENDING)]),
            IndexModel([("performance_tier", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
        ])
        
        print("MongoDB indexes created")


# Collection helpers
def get_collection(name: str):
    """Get a MongoDB collection by name."""
    return MongoDB.db[name]


# Dependency for FastAPI
async def get_mongodb() -> AsyncIOMotorDatabase:
    """
    Dependency to get MongoDB database instance.
    Usage in FastAPI endpoints:
        @app.get("/logs")
        async def get_logs(mongodb: AsyncIOMotorDatabase = Depends(get_mongodb)):
            ...
    """
    return MongoDB.db


# Convenience functions for common collections
def trip_tracking_collection():
    return MongoDB.db.trip_tracking

def vehicle_telemetry_collection():
    return MongoDB.db.vehicle_telemetry

def audit_logs_collection():
    return MongoDB.db.audit_logs

def alert_logs_collection():
    return MongoDB.db.alert_logs

def notification_logs_collection():
    return MongoDB.db.notification_logs

def analytics_snapshots_collection():
    return MongoDB.db.analytics_snapshots

def ai_insights_collection():
    return MongoDB.db.ai_insights
