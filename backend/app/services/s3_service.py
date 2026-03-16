# S3 / File Storage Service
import os
import uuid
import logging
from pathlib import Path

from app.core.config import settings
from app.services.cache_service import is_placeholder

logger = logging.getLogger(__name__)

MOCK_UPLOAD_DIR = Path("/tmp/mock_uploads")


async def upload_file(file_bytes: bytes, filename: str, folder: str = "documents",
                      content_type: str = "application/octet-stream") -> dict:
    """Upload file to S3 or local mock storage."""
    ext = os.path.splitext(filename)[1]
    s3_key = f"{folder}/{uuid.uuid4().hex}{ext}"

    if settings.USE_MOCK_S3 or is_placeholder(settings.AWS_ACCESS_KEY_ID):
        upload_dir = MOCK_UPLOAD_DIR / folder
        upload_dir.mkdir(parents=True, exist_ok=True)
        filepath = MOCK_UPLOAD_DIR / s3_key
        filepath.write_bytes(file_bytes)
        logger.info(f"[MOCK S3] Saved {len(file_bytes)} bytes to {filepath}")
        return {
            "s3_key": s3_key,
            "url": f"/mock-files/{s3_key}",
            "filename": filename,
            "size": len(file_bytes),
            "content_type": content_type,
            "source": "MOCK_DATA",
        }

    import boto3
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    s3.put_object(
        Bucket=settings.AWS_S3_BUCKET, Key=s3_key, Body=file_bytes,
        ContentType=content_type,
    )
    return {
        "s3_key": s3_key,
        "url": f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}",
        "filename": filename,
        "size": len(file_bytes),
        "content_type": content_type,
        "source": "LIVE",
    }


async def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    if settings.USE_MOCK_S3 or is_placeholder(settings.AWS_ACCESS_KEY_ID):
        return f"/mock-files/{s3_key}"

    import boto3
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires_in,
    )


async def delete_file(s3_key: str) -> bool:
    if settings.USE_MOCK_S3 or is_placeholder(settings.AWS_ACCESS_KEY_ID):
        filepath = MOCK_UPLOAD_DIR / s3_key
        if filepath.exists():
            filepath.unlink()
        return True

    import boto3
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
    return True
