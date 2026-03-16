# Document Model
# Transport ERP — PostgreSQL
# Enterprise Document Management System (DMS)
#
# Schema:
# ┌───────────────────────────────────────────────────────────────────┐
# │ documents                                                        │
# │ ─────────────────────────────────────────────────────────────     │
# │ id              SERIAL PRIMARY KEY                               │
# │ doc_number      VARCHAR(30) UNIQUE NOT NULL                      │
# │ title           VARCHAR(255) NOT NULL                            │
# │ document_type   ENUM(rc,insurance,...) NOT NULL                  │
# │ entity_type     ENUM(vehicle,driver,...) NOT NULL                │
# │ entity_id       INT NOT NULL                                     │
# │ entity_label    VARCHAR(200)                                     │
# │ document_number VARCHAR(100)                                     │
# │ issue_date      DATE                                             │
# │ expiry_date     DATE                                             │
# │ reminder_days   INT DEFAULT 30                                   │
# │ compliance_category ENUM(mandatory,optional)                     │
# │ renewal_required BOOLEAN DEFAULT FALSE                           │
# │ expiry_alert    BOOLEAN DEFAULT TRUE                             │
# │ auto_reminder   BOOLEAN DEFAULT TRUE                             │
# │ notes           TEXT                                             │
# │ approval_status ENUM(draft,pending,approved,rejected)            │
# │ rejection_reason TEXT                                            │
# │ file_name       VARCHAR(255)                                     │
# │ file_size       INT                                              │
# │ file_type       VARCHAR(50)                                      │
# │ file_url        VARCHAR(500)                                     │
# │ uploaded_by     INT FK → users(id)                               │
# │ reviewed_by     INT FK → users(id)                               │
# │ tenant_id       INT FK → tenants(id)                             │
# │ branch_id       INT FK → branches(id)                            │
# │ created_at      TIMESTAMP                                        │
# │ updated_at      TIMESTAMP                                        │
# └───────────────────────────────────────────────────────────────────┘
# ┌───────────────────────────────────────────────────────────────────┐
# │ document_versions                                                │
# │ ─────────────────────────────────────────────────────────────     │
# │ id              SERIAL PRIMARY KEY                               │
# │ document_id     INT FK → documents(id) ON DELETE CASCADE         │
# │ version         INT NOT NULL                                     │
# │ file_name       VARCHAR(255)                                     │
# │ file_size       INT                                              │
# │ file_url        VARCHAR(500)                                     │
# │ notes           TEXT                                             │
# │ uploaded_by     INT FK → users(id)                               │
# │ created_at      TIMESTAMP                                        │
# └───────────────────────────────────────────────────────────────────┘

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


# ── Enums ──

class DocumentType(enum.Enum):
    RC = "rc"
    INSURANCE = "insurance"
    FITNESS = "fitness"
    LICENSE = "license"
    POLLUTION = "pollution"
    INVOICE = "invoice"
    EWAY_BILL = "eway_bill"
    LR_COPY = "lr_copy"
    PERMIT = "permit"
    CONTRACT = "contract"
    POD = "pod"
    TAX_RECEIPT = "tax_receipt"
    OTHER = "other"


class EntityType(enum.Enum):
    VEHICLE = "vehicle"
    DRIVER = "driver"
    TRIP = "trip"
    CLIENT = "client"
    FINANCE = "finance"


class ComplianceCategory(enum.Enum):
    MANDATORY = "mandatory"
    OPTIONAL = "optional"


class DocumentApprovalStatus(enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ── Models ──

class Document(Base, TimestampMixin, SoftDeleteMixin):
    """
    Central document store.
    Tracks compliance docs, fleet papers, invoices, LR copies, etc.
    """

    __tablename__ = "documents"

    # Reference
    doc_number = Column(String(30), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)

    # Classification
    document_type = Column(SQLEnum(DocumentType), nullable=False)
    entity_type = Column(SQLEnum(EntityType), nullable=False)
    entity_id = Column(Integer, nullable=False, index=True)
    entity_label = Column(String(200), nullable=True)

    # Document info
    document_number = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)

    # Compliance settings
    reminder_days = Column(Integer, default=30)
    compliance_category = Column(
        SQLEnum(ComplianceCategory), default=ComplianceCategory.OPTIONAL
    )
    renewal_required = Column(Boolean, default=False)
    expiry_alert = Column(Boolean, default=True)
    auto_reminder = Column(Boolean, default=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Approval
    approval_status = Column(
        SQLEnum(DocumentApprovalStatus),
        default=DocumentApprovalStatus.DRAFT,
    )
    rejection_reason = Column(Text, nullable=True)

    # File
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=True)
    file_url = Column(String(500), nullable=True)

    # Ownership
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relationships
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.version.desc()",
    )

    def __repr__(self):
        return f"<Document {self.doc_number} – {self.title}>"


class DocumentVersion(Base, TimestampMixin):
    """
    Immutable version history.
    A new row is created every time a file is replaced.
    """

    __tablename__ = "document_versions"

    document_id = Column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    version = Column(Integer, nullable=False)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    document = relationship("Document", back_populates="versions")

    def __repr__(self):
        return f"<DocumentVersion {self.document_id} v{self.version}>"
