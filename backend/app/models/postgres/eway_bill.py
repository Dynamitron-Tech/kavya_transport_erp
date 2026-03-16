# E-way Bill Model
# Transport ERP - PostgreSQL
# Indian GST E-way Bill Compliance (Rule 138 of CGST Rules)
#
# Status Workflow:
#   Draft → Generated → Active → Completed → Cancelled / Expired
#   Draft → Generated → Active → Extended → Completed
#
# ┌───────────────────────────────────────────────────────────────────┐
# │ eway_bills                                                       │
# │ ─────────────────────────────────────────────────────────────     │
# │ id              SERIAL PRIMARY KEY                               │
# │ eway_bill_number VARCHAR(30) UNIQUE NOT NULL                     │
# │ eway_bill_date  DATE NOT NULL                                    │
# │ status          ENUM(draft,generated,active,...) DEFAULT draft    │
# │ transaction_type  ENUM(outward,inward)                           │
# │ transaction_sub_type  VARCHAR(20)                                │
# │ document_type   ENUM(tax_invoice,bill_of_supply,...)             │
# │ document_number VARCHAR(50)                                      │
# │ document_date   DATE                                             │
# │ job_id          INT FK → jobs(id) NOT NULL                       │
# │ lr_id           INT FK → lrs(id) NULLABLE                       │
# │ supplier_name/address/gstin/state/pincode                        │
# │ recipient_name/address/gstin/state/pincode                       │
# │ vehicle_number, vehicle_type, transport_mode                     │
# │ transporter_id, transporter_name, transporter_gstin              │
# │ distance_km, approximate_distance                                │
# │ total_taxable_value, cgst_amount, sgst_amount, igst_amount,      │
# │ cess_amount, total_invoice_value                                 │
# │ valid_from, valid_until, extended_until                          │
# │ generated_at, generated_by, cancelled_at, cancelled_reason       │
# │ created_by, created_at, updated_at                               │
# │ tenant_id, branch_id                                             │
# └───────────────────────────────────────────────────────────────────┘
# ┌───────────────────────────────────────────────────────────────────┐
# │ eway_items                                                       │
# │ ─────────────────────────────────────────────────────────────     │
# │ id              SERIAL PRIMARY KEY                               │
# │ eway_bill_id    INT FK → eway_bills(id) ON DELETE CASCADE        │
# │ item_number     INT NOT NULL                                     │
# │ product_name    VARCHAR(255) NOT NULL                            │
# │ product_description TEXT                                         │
# │ hsn_code        VARCHAR(20) NOT NULL                             │
# │ quantity        NUMERIC(12,3) NOT NULL                           │
# │ quantity_unit   VARCHAR(20) NOT NULL                             │
# │ taxable_value   NUMERIC(15,2) NOT NULL                           │
# │ cgst_rate       NUMERIC(5,2) DEFAULT 0                           │
# │ cgst_amount     NUMERIC(12,2) DEFAULT 0                          │
# │ sgst_rate       NUMERIC(5,2) DEFAULT 0                           │
# │ sgst_amount     NUMERIC(12,2) DEFAULT 0                          │
# │ igst_rate       NUMERIC(5,2) DEFAULT 0                           │
# │ igst_amount     NUMERIC(12,2) DEFAULT 0                          │
# │ cess_rate       NUMERIC(5,2) DEFAULT 0                           │
# │ cess_amount     NUMERIC(12,2) DEFAULT 0                          │
# │ total_item_value NUMERIC(15,2) NOT NULL                          │
# │ invoice_number  VARCHAR(50)                                      │
# │ invoice_date    DATE                                             │
# └───────────────────────────────────────────────────────────────────┘

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum
from .base import Base, TimestampMixin, SoftDeleteMixin


class EwayBillStatus(enum.Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    ACTIVE = "active"
    IN_TRANSIT = "in_transit"
    EXTENDED = "extended"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class TransactionType(enum.Enum):
    OUTWARD = "outward"
    INWARD = "inward"


class DocumentType(enum.Enum):
    TAX_INVOICE = "tax_invoice"
    BILL_OF_SUPPLY = "bill_of_supply"
    BILL_OF_ENTRY = "bill_of_entry"
    DELIVERY_CHALLAN = "delivery_challan"
    CREDIT_NOTE = "credit_note"
    OTHERS = "others"


class TransportMode(enum.Enum):
    ROAD = "road"
    RAIL = "rail"
    AIR = "air"
    SHIP = "ship"


class VehicleCategory(enum.Enum):
    REGULAR = "regular"
    OVER_DIMENSIONAL_CARGO = "over_dimensional_cargo"


class EwayBill(Base, TimestampMixin, SoftDeleteMixin):
    """E-way Bill model — Indian GST E-way Bill compliance."""

    __tablename__ = "eway_bills"

    # E-way Bill Number
    eway_bill_number = Column(String(30), unique=True, nullable=False, index=True)
    eway_bill_date = Column(Date, nullable=False)

    # Status
    status = Column(SQLEnum(EwayBillStatus), default=EwayBillStatus.DRAFT, nullable=False)

    # Transaction Info
    transaction_type = Column(SQLEnum(TransactionType), default=TransactionType.OUTWARD)
    transaction_sub_type = Column(String(30), nullable=True)  # supply, export, job_work, etc.
    document_type = Column(SQLEnum(DocumentType), default=DocumentType.TAX_INVOICE)
    document_number = Column(String(50), nullable=True)
    document_date = Column(Date, nullable=True)

    # Job & LR Reference
    job_id = Column(Integer, ForeignKey('jobs.id'), nullable=False)
    lr_id = Column(Integer, ForeignKey('lrs.id'), nullable=True)

    # Supplier (From)
    supplier_name = Column(String(200), nullable=False)
    supplier_gstin = Column(String(20), nullable=True)
    supplier_address = Column(Text, nullable=True)
    supplier_city = Column(String(100), nullable=True)
    supplier_state = Column(String(50), nullable=True)
    supplier_state_code = Column(String(5), nullable=True)
    supplier_pincode = Column(String(10), nullable=True)
    supplier_phone = Column(String(20), nullable=True)

    # Recipient (To)
    recipient_name = Column(String(200), nullable=False)
    recipient_gstin = Column(String(20), nullable=True)
    recipient_address = Column(Text, nullable=True)
    recipient_city = Column(String(100), nullable=True)
    recipient_state = Column(String(50), nullable=True)
    recipient_state_code = Column(String(5), nullable=True)
    recipient_pincode = Column(String(10), nullable=True)
    recipient_phone = Column(String(20), nullable=True)

    # Transport Details
    transport_mode = Column(SQLEnum(TransportMode), default=TransportMode.ROAD)
    vehicle_number = Column(String(20), nullable=True)
    vehicle_type = Column(SQLEnum(VehicleCategory), default=VehicleCategory.REGULAR)
    transporter_id = Column(String(20), nullable=True)  # Transporter GSTIN or ID
    transporter_name = Column(String(200), nullable=True)
    transporter_gstin = Column(String(20), nullable=True)

    # Distance
    distance_km = Column(Integer, nullable=True)
    approximate_distance = Column(Boolean, default=False)

    # Values
    total_taxable_value = Column(Numeric(15, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    cess_amount = Column(Numeric(12, 2), default=0)
    total_invoice_value = Column(Numeric(15, 2), default=0)

    # Validity
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    extended_until = Column(DateTime, nullable=True)
    extension_count = Column(Integer, default=0)
    extension_reason = Column(Text, nullable=True)

    # Generation
    generated_at = Column(DateTime, nullable=True)
    generated_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Cancellation
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    cancelled_reason = Column(Text, nullable=True)

    # GST Portal Reference
    gst_portal_ref = Column(String(50), nullable=True)  # NIC E-way Bill reference

    # Remarks
    remarks = Column(Text, nullable=True)

    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    job = relationship("Job")
    lr = relationship("LR")
    items = relationship("EwayItem", back_populates="eway_bill", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<EwayBill {self.eway_bill_number}>"


class EwayItem(Base, TimestampMixin):
    """Line items in E-way Bill — individual goods being transported."""

    __tablename__ = "eway_items"

    eway_bill_id = Column(Integer, ForeignKey('eway_bills.id', ondelete='CASCADE'), nullable=False)

    # Item Details
    item_number = Column(Integer, nullable=False)
    product_name = Column(String(255), nullable=False)
    product_description = Column(Text, nullable=True)
    hsn_code = Column(String(20), nullable=False)

    # Quantity
    quantity = Column(Numeric(12, 3), nullable=False)
    quantity_unit = Column(String(20), nullable=False)  # KGS, NOS, LTR, MTR, etc.

    # Tax Values
    taxable_value = Column(Numeric(15, 2), nullable=False)
    cgst_rate = Column(Numeric(5, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_rate = Column(Numeric(5, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_rate = Column(Numeric(5, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    cess_rate = Column(Numeric(5, 2), default=0)
    cess_amount = Column(Numeric(12, 2), default=0)
    total_item_value = Column(Numeric(15, 2), nullable=False)

    # Invoice Reference
    invoice_number = Column(String(50), nullable=True)
    invoice_date = Column(Date, nullable=True)

    # Relationships
    eway_bill = relationship("EwayBill", back_populates="items")

    def __repr__(self):
        return f"<EwayItem {self.item_number}: {self.product_name}>"
