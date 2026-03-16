# S3 / File Storage Service
import os
import uuid
import logging
import httpx
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


async def upload_file(file_bytes: bytes, filename: str, folder: str = "documents",
                      content_type: str = "application/octet-stream") -> dict:
    ext = os.path.splitext(filename)[1]
    s3_key = f"{folder}/{uuid.uuid4().hex}{ext}"
    try:
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
            "filename": filename, "size": len(file_bytes),
            "content_type": content_type, "source": "LIVE",
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="boto3 not installed. Run: pip install boto3")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"S3 upload failed: {str(e)[:200]}. Check AWS credentials in .env")


async def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    try:
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
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"S3 presigned URL failed: {str(e)[:200]}")


async def delete_file(s3_key: str) -> bool:
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
        return True
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"S3 delete failed: {str(e)[:200]}")
