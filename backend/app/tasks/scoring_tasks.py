# Driver Scoring Celery Tasks
# Transport ERP — Phase C: Periodic score computation & behavior event capture

import logging
from datetime import datetime
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.scoring_tasks.compute_monthly_scores")
def compute_monthly_scores():
    """
    Periodic task (1st of each month): compute previous month's scores for all drivers.
    Runs synchronously in Celery worker.
    """
    logger.info("Running monthly driver score computation")
    # In production:
    # 1. Get all active drivers
    # 2. For each driver, call driver_scoring_service.compute_monthly_score()
    #    with the previous month's dates
    # 3. Store results in cache/DB for fast leaderboard queries
    now = datetime.utcnow()
    # Previous month
    if now.month == 1:
        prev_month, prev_year = 12, now.year - 1
    else:
        prev_month, prev_year = now.month - 1, now.year

    logger.info(f"Computing scores for {prev_year}-{prev_month:02d}")
    return {
        "month": prev_month,
        "year": prev_year,
        "drivers_processed": 0,
        "status": "placeholder",
    }


@celery_app.task(name="app.tasks.scoring_tasks.capture_behavior_events")
def capture_behavior_events():
    """
    Periodic task (every 60 sec): process GPS telemetry data delta
    into behavior events (harsh brake, overspeed, excessive idle, etc.).
    """
    logger.info("Capturing driver behavior events from GPS data")
    # In production:
    # 1. Read latest GPS data batch from MongoDB/Redis
    # 2. For each data point, detect:
    #    - Harsh braking: speed drop > 0.4g in < 2 sec
    #    - Harsh acceleration: speed gain > 0.4g in < 2 sec
    #    - Overspeeding: > 80 kmph for > 30 sec
    #    - Excessive idle: speed = 0, engine on for > 15 min
    #    - Night driving: movement between 23:00 - 05:00 IST
    # 3. Create DriverEvent records in PostgreSQL
    # 4. Push WebSocket alerts for severe events
    return {"processed": 0, "events_created": 0}
