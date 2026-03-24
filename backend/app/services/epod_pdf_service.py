# ePOD PDF Builder — Generates electronic Proof of Delivery PDFs
# Uses reportlab to build a professional PDF with trip, LR, and delivery details.

import io
import logging
from datetime import datetime, timezone
from typing import Optional

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

from app.models.postgres.trip import Trip
from app.models.postgres.lr import LR
from app.services import s3_service

logger = logging.getLogger(__name__)


async def build_epod_pdf(db: AsyncSession, trip_id: int) -> bytes:
    """Build an ePOD PDF for a completed trip. Returns raw PDF bytes."""

    # Load trip
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.is_deleted == False)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    # Load associated LRs with items
    lr_result = await db.execute(
        select(LR)
        .options(selectinload(LR.items))
        .where(LR.trip_id == trip_id, LR.is_deleted == False)
    )
    lrs = lr_result.scalars().all()

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "EPODTitle", parent=styles["Heading1"],
        fontSize=18, textColor=colors.HexColor("#1a237e"),
        spaceAfter=6 * mm,
    )
    heading_style = ParagraphStyle(
        "EPODHeading", parent=styles["Heading2"],
        fontSize=12, textColor=colors.HexColor("#283593"),
        spaceBefore=4 * mm, spaceAfter=2 * mm,
    )
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.grey)

    elements = []

    # Header
    elements.append(Paragraph("ELECTRONIC PROOF OF DELIVERY", title_style))
    elements.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%d-%b-%Y %H:%M UTC')}",
        small,
    ))
    elements.append(Spacer(1, 4 * mm))

    # Trip Summary Table
    elements.append(Paragraph("Trip Details", heading_style))
    trip_data = [
        ["Trip Number", trip.trip_number or "—", "Status", str(getattr(trip.status, "value", trip.status) or "—")],
        ["Origin", trip.origin or "—", "Destination", trip.destination or "—"],
        ["Vehicle", trip.vehicle_registration or "—", "Driver", trip.driver_name or "—"],
        ["Trip Date", str(trip.trip_date) if trip.trip_date else "—", "Driver Phone", trip.driver_phone or "—"],
        [
            "Start",
            trip.actual_start.strftime("%d-%b-%Y %H:%M") if trip.actual_start else "—",
            "End",
            trip.actual_end.strftime("%d-%b-%Y %H:%M") if trip.actual_end else "—",
        ],
        [
            "Distance (km)",
            f"{trip.actual_distance_km:.1f}" if trip.actual_distance_km else "—",
            "POD Collected",
            "Yes" if trip.pod_collected else "No",
        ],
    ]
    trip_table = Table(trip_data, colWidths=[35 * mm, 55 * mm, 35 * mm, 55 * mm])
    trip_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8eaf6")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#e8eaf6")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c5cae9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(trip_table)
    elements.append(Spacer(1, 4 * mm))

    # LR Details
    if lrs:
        elements.append(Paragraph("Consignment Details (LRs)", heading_style))
        for lr in lrs:
            lr_header = [
                ["LR Number", lr.lr_number or "—", "LR Date", str(lr.lr_date) if lr.lr_date else "—"],
                ["Consignor", lr.consignor_name or "—", "Consignee", lr.consignee_name or "—"],
                ["From", lr.origin or "—", "To", lr.destination or "—"],
                ["Freight", f"₹{lr.total_freight:,.2f}" if lr.total_freight else "—",
                 "Payment", str(getattr(lr.payment_mode, "value", lr.payment_mode) or "—")],
                ["Delivered At",
                 lr.delivered_at.strftime("%d-%b-%Y %H:%M") if lr.delivered_at else "—",
                 "Received By", lr.received_by or "—"],
            ]
            lr_table = Table(lr_header, colWidths=[30 * mm, 60 * mm, 30 * mm, 60 * mm])
            lr_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#fff3e0")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#fff3e0")),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ffe0b2")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            elements.append(lr_table)

            # LR Items
            if lr.items:
                item_header = [["#", "Description", "Packages", "Weight (kg)", "Rate", "Amount"]]
                for item in sorted(lr.items, key=lambda x: x.item_number):
                    item_header.append([
                        str(item.item_number),
                        item.description or "—",
                        str(item.packages or "—"),
                        f"{item.actual_weight:.1f}" if item.actual_weight else "—",
                        f"₹{item.rate:,.2f}" if item.rate else "—",
                        f"₹{item.amount:,.2f}" if item.amount else "—",
                    ])
                item_table = Table(item_header, colWidths=[10 * mm, 60 * mm, 20 * mm, 25 * mm, 25 * mm, 30 * mm])
                item_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e0e0")),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ]))
                elements.append(Spacer(1, 2 * mm))
                elements.append(item_table)

            elements.append(Spacer(1, 3 * mm))

    # Financial Summary
    elements.append(Paragraph("Financial Summary", heading_style))
    fin_data = [
        ["Revenue", f"₹{trip.revenue:,.2f}" if trip.revenue else "₹0.00"],
        ["Total Expense", f"₹{trip.total_expense:,.2f}" if trip.total_expense else "₹0.00"],
        ["Profit/Loss", f"₹{trip.profit_loss:,.2f}" if trip.profit_loss else "₹0.00"],
        ["Driver Advance", f"₹{trip.driver_advance:,.2f}" if trip.driver_advance else "₹0.00"],
    ]
    fin_table = Table(fin_data, colWidths=[50 * mm, 50 * mm])
    fin_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f5e9")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c8e6c9")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    elements.append(fin_table)
    elements.append(Spacer(1, 6 * mm))

    # Signature blocks
    elements.append(Paragraph("Acknowledgement", heading_style))
    sig_data = [
        ["Driver Signature", "", "Receiver Signature", ""],
        ["Name: " + (trip.driver_name or "________________"), "",
         "Name: " + (lrs[0].received_by if lrs and lrs[0].received_by else "________________"), ""],
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
        "This is a system-generated electronic Proof of Delivery. "
        "Kavya Transports — Transport ERP",
        small,
    ))

    doc.build(elements)
    return buffer.getvalue()


async def generate_and_upload_epod(db: AsyncSession, trip_id: int) -> dict:
    """Generate ePOD PDF and upload to storage. Returns upload metadata."""
    pdf_bytes = await build_epod_pdf(db, trip_id)
    filename = f"epod_trip_{trip_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
    upload_result = await s3_service.upload_file(
        pdf_bytes, filename, folder="epod", content_type="application/pdf",
    )
    logger.info(f"ePOD PDF generated for trip {trip_id}: {upload_result.get('url')}")
    return upload_result
