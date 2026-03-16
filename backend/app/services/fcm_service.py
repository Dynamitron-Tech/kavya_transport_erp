# FCM Push Notification Service
import logging
from app.core.config import settings
from app.services.cache_service import is_placeholder

logger = logging.getLogger(__name__)


async def send_push_notification(device_token: str, title: str, body: str, data: dict | None = None) -> dict:
    if is_placeholder(settings.FIREBASE_CREDENTIALS_PATH):
        logger.info(f"[MOCK FCM] → {device_token[:20]}... | {title}: {body}")
        return {
            "success": True,
            "message_id": f"mock_msg_{id(body)}",
            "device_token": device_token,
            "source": "MOCK_DATA",
        }

    import firebase_admin
    from firebase_admin import messaging, credentials

    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        token=device_token,
    )
    response = messaging.send(message)
    return {"success": True, "message_id": response, "source": "LIVE"}


async def send_push_to_topic(topic: str, title: str, body: str, data: dict | None = None) -> dict:
    if is_placeholder(settings.FIREBASE_CREDENTIALS_PATH):
        logger.info(f"[MOCK FCM TOPIC] → {topic} | {title}: {body}")
        return {"success": True, "topic": topic, "source": "MOCK_DATA"}

    import firebase_admin
    from firebase_admin import messaging, credentials

    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        topic=topic,
    )
    response = messaging.send(message)
    return {"success": True, "message_id": response, "topic": topic, "source": "LIVE"}


async def send_push_to_multiple(device_tokens: list[str], title: str, body: str, data: dict | None = None) -> dict:
    if is_placeholder(settings.FIREBASE_CREDENTIALS_PATH):
        logger.info(f"[MOCK FCM MULTI] → {len(device_tokens)} devices | {title}: {body}")
        return {
            "success": True,
            "success_count": len(device_tokens),
            "failure_count": 0,
            "source": "MOCK_DATA",
        }

    import firebase_admin
    from firebase_admin import messaging, credentials

    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=device_tokens,
    )
    response = messaging.send_each_for_multicast(message)
    return {
        "success": True,
        "success_count": response.success_count,
        "failure_count": response.failure_count,
        "source": "LIVE",
    }
