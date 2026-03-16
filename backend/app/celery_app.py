# Celery Application — background task processing
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "transport_erp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 min hard limit
    task_soft_time_limit=240,  # 4 min soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    beat_schedule={
        "check-compliance-daily": {
            "task": "app.tasks.compliance_tasks.check_all_compliance",
            "schedule": 86400.0,  # once a day
        },
        "sync-eway-bill-status": {
            "task": "app.tasks.eway_bill_tasks.sync_active_eway_bills",
            "schedule": 3600.0,  # every hour
        },
        "update-fuel-prices": {
            "task": "app.tasks.fuel_price_tasks.refresh_fuel_prices",
            "schedule": 21600.0,  # every 6 hours
        },
    },
)

# Auto-discover tasks from app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])
