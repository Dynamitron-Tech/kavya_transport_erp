# LR (Lorry Receipt) PDF Builder — Generates professional LR PDFs
# Uses reportlab for Indian transport industry standard LR format.

import io
import logging
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.postgres.lr import LR, LRItem
from app.models.postgres.job import Job
from app.models.postgres.vehicle import Vehicle
from app.models.postgres.driver import Driver
from app.services import s3_service

logger = logging.getLogger(__name__)

# --- Colour palette ---
_DARK_BLUE = colors.HexColor("#1a237e")
_MED_BLUE = colors.HexColor("#283593")
_LIGHT_BLUE = colors.HexColor("#e8eaf6")
_BORDER_BLUE = colors.HexColor("#c5cae9")
_LIGHT_ORANGE = colors.HexColor("#fff3e0")
_BORDER_ORANGE = colors.HexColor("#ffe0b2")
_LIGHT_GREEN = colors.HexColor("#e8f5e9")
_BORDER_GREEN = colors.HexColor("#c8e6c9")
_GREY_BG = colors.HexColor("#e0e0e0")


def _safe(val, fmt=None):
    """Return formatted value or dash."""
    if val is None:
        return "—"
    if fmt == "currency":
        return f"₹{float(val):,.2f}"
    if fmt == "date":
        return str(val)
    return str(val) if val else "—"


def _enum_val(obj):
    return str(getattr(obj, "value", obj) or "—")


async def build_lr_pdf(db: AsyncSession, lr_id: int) -> bytes:
    """Build a professional LR PDF. Returns raw PDF bytes."""

    result = await db.execute(
        select(LR)
        .options(selectinload(LR.items))
        .where(LR.id == lr_id, LR.is_deleted == False)
    )
    lr = result.scalar_one_or_none()
    if not lr:
        raise ValueError(f"LR {lr_id} not found")

    # Fetch related entities
    job_number = None
    if lr.job_id:
        r = await db.execute(select(Job.job_number).where(Job.id == lr.job_id))
        job_number = r.scalar_one_or_none()

    vehicle_reg = None
    if lr.vehicle_id:
        r = await db.execute(select(Vehicle.registration_number).where(Vehicle.id == lr.vehicle_id))
        vehicle_reg = r.scalar_one_or_none()

    driver_name = None
    if lr.driver_id:
        r = await db.execute(select(Driver.first_name).where(Driver.id == lr.driver_id))
        driver_name = r.scalar_one_or_none()

    # --- Build PDF ---
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "LRTitle", parent=styles["Heading1"],
        fontSize=18, textColor=_DARK_BLUE, spaceAfter=2 * mm,
    )
    subtitle_style = ParagraphStyle(
        "LRSub", parent=styles["Normal"],
        fontSize=10, textColor=colors.grey, spaceAfter=4 * mm,
    )
    heading_style = ParagraphStyle(
        "LRHeading", parent=styles["Heading2"],
        fontSize=12, textColor=_MED_BLUE,
        spaceBefore=4 * mm, spaceAfter=2 * mm,
    )
    small = ParagraphStyle("LRSmall", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    elements = []

    # ── Header ──
    elements.append(Paragraph("LORRY RECEIPT / CONSIGNMENT NOTE", title_style))
    elements.append(Paragraph("Kavya Transports — Transport ERP", subtitle_style))

    # ── LR Info ──
    lr_info = [
        ["LR Number", _safe(lr.lr_number), "LR Date", _safe(lr.lr_date, "date")],
        ["Status", _enum_val(lr.status), "Job Number", _safe(job_number)],
        ["Vehicle", _safe(vehicle_reg), "Driver", _safe(driver_name)],
    ]
    _add_kv_table(elements, lr_info, _LIGHT_BLUE, _BORDER_BLUE)
    elements.append(Spacer(1, 4 * mm))

    # ── Consignor / Consignee ──
    elements.append(Paragraph("Consignor & Consignee", heading_style))
    party_data = [
        ["Consignor", _safe(lr.consignor_name), "Consignee", _safe(lr.consignee_name)],
        ["Address", _safe(lr.consignor_address), "Address", _safe(lr.consignee_address)],
        ["GSTIN", _safe(lr.consignor_gstin), "GSTIN", _safe(lr.consignee_gstin)],
        ["Phone", _safe(lr.consignor_phone), "Phone", _safe(lr.consignee_phone)],
    ]
    _add_kv_table(elements, party_data, _LIGHT_ORANGE, _BORDER_ORANGE)
    elements.append(Spacer(1, 4 * mm))

    # ── Route ──
    elements.append(Paragraph("Route & E-Way Bill", heading_style))
    route_data = [
        ["Origin", _safe(lr.origin), "Destination", _safe(lr.destination)],
        ["E-Way Bill No.", _safe(lr.eway_bill_number), "E-Way Bill Date", _safe(lr.eway_bill_date, "date")],
    ]
    _add_kv_table(elements, route_data, _LIGHT_BLUE, _BORDER_BLUE)
    elements.append(Spacer(1, 4 * mm))

    # ── Items Table ──
    items = sorted(lr.items, key=lambda x: x.item_number) if lr.items else []
    if items:
        elements.append(Paragraph("Goods / Materials", heading_style))
        header = [["#", "Description", "HSN", "Pkgs", "Type", "Wt (kg)", "Chg Wt", "Rate", "Amount"]]
        for item in items:
            header.append([
                str(item.item_number),
                _safe(item.description),
                _safe(item.hsn_code),
                str(item.packages or "—"),
                _safe(item.package_type),
                f"{item.actual_weight:.1f}" if item.actual_weight else "—",
                f"{item.charged_weight:.1f}" if item.charged_weight else "—",
                _safe(item.rate, "currency") if item.rate else "—",
                _safe(item.amount, "currency") if item.amount else "—",
            ])
        col_w = [8 * mm, 42 * mm, 16 * mm, 14 * mm, 16 * mm, 18 * mm, 18 * mm, 20 * mm, 24 * mm]
        item_table = Table(header, colWidths=col_w)
        item_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _GREY_BG),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(item_table)
        elements.append(Spacer(1, 4 * mm))

    # ── Freight Breakdown ──
    elements.append(Paragraph("Freight & Charges", heading_style))
    freight_data = [
        ["Freight Amount", _safe(lr.freight_amount, "currency")],
        ["Loading Charges", _safe(lr.loading_charges, "currency")],
        ["Unloading Charges", _safe(lr.unloading_charges, "currency")],
        ["Detention Charges", _safe(lr.detention_charges, "currency")],
        ["Other Charges", _safe(lr.other_charges, "currency")],
        ["Total Freight", _safe(lr.total_freight, "currency")],
    ]
    freight_table = Table(freight_data, colWidths=[50 * mm, 50 * mm])
    freight_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), _LIGHT_GREEN),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), _BORDER_GREEN),
        ("GRID", (0, 0), (-1, -1), 0.5, _BORDER_GREEN),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    elements.append(freight_table)
    elements.append(Spacer(1, 4 * mm))

    # ── Payment & Insurance ──
    elements.append(Paragraph("Payment & Insurance", heading_style))
    pi_data = [
        ["Payment Mode", _enum_val(lr.payment_mode), "Declared Value", _safe(lr.declared_value, "currency")],
        ["Insurance Co.", _safe(lr.insurance_company), "Policy No.", _safe(lr.insurance_policy_number)],
        ["Insured Amount", _safe(lr.insurance_amount, "currency"), "", ""],
    ]
    _add_kv_table(elements, pi_data, _LIGHT_BLUE, _BORDER_BLUE)
    elements.append(Spacer(1, 4 * mm))

    # ── Delivery (if delivered) ──
    if lr.delivered_at:
        elements.append(Paragraph("Delivery Details", heading_style))
        del_data = [
            ["Delivered At", lr.delivered_at.strftime("%d-%b-%Y %H:%M"), "Received By", _safe(lr.received_by)],
            ["Remarks", _safe(lr.delivery_remarks), "POD Uploaded", "Yes" if lr.pod_uploaded else "No"],
        ]
        _add_kv_table(elements, del_data, _LIGHT_ORANGE, _BORDER_ORANGE)
        elements.append(Spacer(1, 4 * mm))

    # ── Special Instructions ──
    if lr.remarks or lr.special_instructions:
        elements.append(Paragraph("Notes & Instructions", heading_style))
        if lr.remarks:
            elements.append(Paragraph(f"<b>Remarks:</b> {lr.remarks}", styles["Normal"]))
        if lr.special_instructions:
            elements.append(Paragraph(f"<b>Special Instructions:</b> {lr.special_instructions}", styles["Normal"]))
        elements.append(Spacer(1, 4 * mm))

    # ── Signature Blocks ──
    elements.append(Paragraph("Signatures", heading_style))
    sig_data = [
        ["Consignor / Agent", "", "Carrier / Driver", ""],
        ["Name: ________________", "", "Name: ________________", ""],
        ["Signature: ________________", "", "Signature: ________________", ""],
        ["Date: ________________", "", "Date: ________________", ""],
    ]
    sig_table = Table(sig_data, colWidths=[60 * mm, 30 * mm, 60 * mm, 30 * mm])
    sig_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(sig_table)

    # Footer
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%d-%b-%Y %H:%M UTC')} | "
        "This is a system-generated Lorry Receipt. Kavya Transports — Transport ERP",
        small,
    ))

    doc.build(elements)
    return buffer.getvalue()


def _add_kv_table(elements, data, label_bg, border_color):
    """Helper: add a 4-column key-value table."""
    tbl = Table(data, colWidths=[35 * mm, 55 * mm, 35 * mm, 55 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), label_bg),
        ("BACKGROUND", (2, 0), (2, -1), label_bg),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(tbl)


async def generate_and_upload_lr_pdf(db: AsyncSession, lr_id: int) -> dict:
    """Generate LR PDF and upload to S3. Returns upload metadata."""
    pdf_bytes = await build_lr_pdf(db, lr_id)

    lr = await db.execute(select(LR.lr_number).where(LR.id == lr_id))
    lr_number = lr.scalar_one_or_none() or f"LR-{lr_id}"
    filename = f"lr/{lr_number}.pdf"

    try:
        url = await s3_service.upload_bytes(pdf_bytes, filename, "application/pdf")
        return {"url": url, "filename": filename, "size_bytes": len(pdf_bytes)}
    except Exception as exc:
        logger.warning("S3 upload failed for LR %s: %s — returning bytes only", lr_id, exc)
        return {"url": None, "filename": filename, "size_bytes": len(pdf_bytes)}
