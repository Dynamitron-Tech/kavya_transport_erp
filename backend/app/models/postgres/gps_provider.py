# GPS Provider Model
# Transport ERP - PostgreSQL

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from .base import Base


class GPSProvider(Base):
    """GPS data provider configuration (one row per provider)."""

    __tablename__ = "gps_providers"

    id = Column(String(30), primary_key=True)              # 'ialert', 'tata_gps', 'third_party'
    name = Column(String(60), nullable=False)
    api_key_encrypted = Column(Text, nullable=True)         # encrypted, NULL if not yet received
    api_endpoint = Column(Text, nullable=True)
    status = Column(String(20), server_default='pending', nullable=False)  # active/pending/error/disabled
    poll_interval_seconds = Column(Integer, server_default='60', nullable=False)
    vehicle_count = Column(Integer, server_default='0', nullable=False)
    last_poll_at = Column(DateTime(timezone=True), nullable=True)
    last_poll_status = Column(String(20), nullable=True)
    error_message = Column(Text, nullable=True)
    enabled = Column(Boolean, server_default='false', nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    def __repr__(self):
        return f"<GPSProvider {self.id}: {self.status}>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "enabled": self.enabled,
            "vehicle_count": self.vehicle_count,
            "poll_interval_seconds": self.poll_interval_seconds,
            "last_poll_at": self.last_poll_at.isoformat() if self.last_poll_at else None,
            "last_poll_status": self.last_poll_status,
            "error_message": self.error_message,
            "api_endpoint": self.api_endpoint,
        }
