# FCM Push Notification Service
import logging
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


def _init_firebase():
    import firebase_admin
    from firebase_admin import credentials
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)


async def send_push_notification(device_token: str, title: str, body: str, data: dict | None = None) -> dict:
    try:
        _init_firebase()
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=device_token,
        )
        response = messaging.send(message)
        return {"success": True, "message_id": response, "source": "LIVE"}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Firebase credentials file not found. Check FIREBASE_CREDENTIALS_PATH in .env")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"FCM send failed: {str(e)[:200]}")


async def send_push_to_topic(topic: str, title: str, body: str, data: dict | None = None) -> dict:
    try:
        _init_firebase()
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            topic=topic,
        )
        response = messaging.send(message)
        return {"success": True, "message_id": response, "topic": topic, "source": "LIVE"}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Firebase credentials file not found. Check FIREBASE_CREDENTIALS_PATH in .env")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"FCM topic send failed: {str(e)[:200]}")


async def send_push_to_multiple(device_tokens: list[str], title: str, body: str, data: dict | None = None) -> dict:
    try:
        _init_firebase()
        from firebase_admin import messaging
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=device_tokens,
        )
        response = messaging.send_each_for_multicast(message)
        return {
            "success": True, "success_count": response.success_count,
            "failure_count": response.failure_count, "source": "LIVE",
        }
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Firebase credentials file not found. Check FIREBASE_CREDENTIALS_PATH in .env")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"FCM multicast failed: {str(e)[:200]}")
