# Geofence Celery Tasks
# Transport ERP — Phase B: Periodic geofence checking

import logging
from datetime import datetime, timedelta
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.geofence_tasks.check_geofences_periodic")
def check_geofences_periodic():
    """
    Periodic task (every 30 sec): check all active trips' latest GPS position
    against geofences, create driver_events on breach.
    Runs synchronously in Celery worker; uses sync DB session.
    """
    logger.info("Running periodic geofence check")
    # In production this would:
    # 1. Query all active trips with latest GPS position from MongoDB/Redis
    # 2. For each, call geofence_service.detect_breach_and_record()
    # 3. Push WebSocket alerts for any breaches
    # Placeholder — actual GPS data integration depends on tracker hardware
    return {"checked": 0, "breaches": 0}


@celery_app.task(name="app.tasks.geofence_tasks.check_unauthorized_halts")
def check_unauthorized_halts():
    """
    Periodic task (every 5 min): check for vehicles stopped >30 min
    at non-approved locations.
    """
    logger.info("Checking for unauthorized halts")
    # In production:
    # 1. Query vehicles with speed=0 for >30 min from GPS data store
    # 2. Check if halt location is inside any LOADING/UNLOADING/FUEL_STATION geofence
    # 3. If not, create UNAUTHORIZED_HALT driver event
    return {"checked": 0, "halts": 0}


@celery_app.task(name="app.tasks.geofence_tasks.check_night_movement")
def check_night_movement():
    """
    Periodic task: check for vehicle movement between 11 PM–5 AM on non-trip days.
    """
    logger.info("Checking for unauthorized night movement")
    now = datetime.utcnow() + timedelta(hours=5, minutes=30)  # IST
    hour = now.hour
    if hour < 23 and hour >= 5:
        return {"skipped": True, "reason": "Not in night window (23:00-05:00 IST)"}

    # In production:
    # 1. Find vehicles with movement in night window
    # 2. Check if vehicle has an active trip
    # 3. If no active trip, create NIGHT_DRIVING driver event
    return {"checked": 0, "violations": 0}
