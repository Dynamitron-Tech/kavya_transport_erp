# Core Configuration
# Transport ERP - FastAPI Backend

from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv


ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"

# Prefer repository-local backend/.env values over inherited shell vars.
load_dotenv(dotenv_path=ENV_FILE_PATH, override=True)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "Transport ERP"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "transport_erp"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "transport_erp"
    
    @property
    def POSTGRES_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def POSTGRES_URL_SYNC(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "transport_erp_logs"
    
    # Redis (Cache)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    
    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    
    # Government APIs
    VAHAN_API_KEY: str = "YOUR_VAHAN_API_KEY_HERE"
    VAHAN_API_URL: str = "https://vahan.nic.in/nrservices/faces/user/searchstatus.xhtml"
    SARATHI_API_KEY: str = "YOUR_SARATHI_API_KEY_HERE"
    ECHALLAN_API_KEY: str = "YOUR_ECHALLAN_API_KEY_HERE"
    ECHALLAN_API_URL: str = "https://echallan.parivahan.gov.in/api"
    
    # GST & E-way Bill
    EWAY_BILL_USERNAME: str = "YOUR_EWAYB_USERNAME_HERE"
    EWAY_BILL_PASSWORD: str = "YOUR_EWAYB_PASSWORD_HERE"
    EWAY_BILL_GSTIN: str = "YOUR_COMPANY_GSTIN_HERE"
    EWAY_BILL_API_URL: str = "https://sandboxeinvoice.gst.gov.in/ewayapi"
    GST_VERIFY_API_KEY: str = "YOUR_GST_VERIFY_KEY_HERE"
    
    # Google APIs
    GOOGLE_MAPS_API_KEY: str = "YOUR_GOOGLE_MAPS_API_KEY_HERE"
    
    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "YOUR_FIREBASE_CREDENTIALS_PATH_HERE"
    
    # File Storage (S3)
    STORAGE_TYPE: str = "local"
    STORAGE_BUCKET: str = "transport-erp"
    AWS_ACCESS_KEY_ID: str = "YOUR_AWS_ACCESS_KEY_HERE"
    AWS_SECRET_ACCESS_KEY: str = "YOUR_AWS_SECRET_KEY_HERE"
    AWS_S3_BUCKET: str = "YOUR_S3_BUCKET_NAME_HERE"
    AWS_REGION: str = "ap-south-1"
    MINIO_ENDPOINT: Optional[str] = None
    
    # Communication
    MSG91_API_KEY: str = "YOUR_MSG91_API_KEY_HERE"
    MSG91_SENDER_ID: str = "KAVYAT"
    WHATSAPP_API_KEY: str = "YOUR_GUPSHUP_API_KEY_HERE"
    WHATSAPP_SOURCE_NUMBER: str = "YOUR_WHATSAPP_NUMBER_HERE"
    BREVO_API_KEY: str = "YOUR_BREVO_API_KEY_HERE"
    BREVO_SMS_SENDER: str = "KavyaTrans"  # Max 11 chars
    
    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@transporterp.com"
    
    # Finance

    # AI / Document Extraction
    ANTHROPIC_API_KEY: str = ""

    # GPS Device
    GPS_TCP_HOST: str = "0.0.0.0"
    GPS_TCP_PORT: int = 5000
    GPS_PROVIDER: str = "internal"
    GPS_API_KEY: Optional[str] = None

    # Ashok Leyland iALERT — Data as a Service (GPS Telematics)
    IALERT_API_URL: str = "https://ialert2.ashokleyland.com/ialert/daas/api/getdata"
    IALERT_API_TOKEN: Optional[str] = None  # Token shared by AL team
    IALERT_POLL_INTERVAL_SECONDS: int = 60  # Polling frequency (seconds)
    IALERT_ENABLED: bool = False  # Enable only after token is configured

    # Tata Motors GPS (fill when API key arrives)
    TATA_GPS_API_KEY: Optional[str] = None
    TATA_GPS_API_ENDPOINT: str = "https://fleet.tatamotors.com/api/v1"

    # Third-party GPS (fill when API key arrives)
    THIRD_PARTY_GPS_API_KEY: Optional[str] = None
    THIRD_PARTY_GPS_API_ENDPOINT: str = ""

    # GPS feature flags
    GPS_CACHE_TTL: int = 120  # seconds to show stale data before marking offline
    
    # Push Notifications (Firebase)
    FCM_SERVER_KEY: Optional[str] = None

    # Razorpay — incoming client payment gateway
    # Set RAZORPAY_ENABLED=true once keys arrive (2-3 days)
    RAZORPAY_ENABLED: bool = False
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None  # Set in Razorpay dashboard → Webhooks

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_file = str(ENV_FILE_PATH)
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
