"""
Payment Service — High-level orchestrator for all outgoing payments.
Validates, creates DB records, calls Razorpay, handles webhooks.
"""

import logging
from datetime import datetime, date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.postgres.payment import PaymentContact, Payout, ExpenseSubmission
from app.services import razorpay_payout_service as rpx

logger = logging.getLogger(__name__)


async def _get_contact(db: AsyncSession, entity_id: int, contact_type: str) -> Optional[PaymentContact]:
    """Find active, verified payment contact for an entity."""
    result = await db.execute(
        select(PaymentContact).where(
            PaymentContact.entity_id == entity_id,
            PaymentContact.contact_type == contact_type,
            PaymentContact.is_active == True,
        ).order_by(PaymentContact.is_verified.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def initiate_salary_payment(
    db: AsyncSession,
    employee_id: int,
    amount_paise: int,
    month: str,
    initiated_by: int,
    employee_name: str = "",
) -> Payout:
    """
    1. Look up payment contact
    2. Check for duplicate salary payout for this employee+month
    3. Call Razorpay payout
    4. Create Payout record
    """
    contact = await _get_contact(db, employee_id, "staff")
    if not contact:
        contact = await _get_contact(db, employee_id, "driver")

    # Check for duplicate
    dup = await db.execute(
        select(Payout).where(
            Payout.payout_type == "salary",
            Payout.reference_id == f"{employee_id}_{month}",
            Payout.status.in_(["pending", "processing", "processed", "queued"]),
        )
    )
    if dup.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail=f"Salary for {month} already initiated for this employee.")

    mode = rpx.select_mode(amount_paise, "salary")

    payout = Payout(
        payout_type="salary",
        contact_id=contact.id if contact else None,
        amount_paise=amount_paise,
        payment_method=mode.lower(),
        purpose="salary",
        narration=f"Salary {month} - {employee_name}"[:30],
        reference_type="salary_month",
        reference_id=f"{employee_id}_{month}",
        status="pending",
        initiated_by=initiated_by,
        recipient_name=employee_name,
        recipient_bank_last4=contact.bank_account_number[-4:] if contact and contact.bank_account_number else None,
    )

    # Attempt Razorpay if contact has fund account
    if contact and contact.razorpay_fund_account_id:
        try:
            result = await rpx.create_payout(
                fund_account_id=contact.razorpay_fund_account_id,
                amount_paise=amount_paise,
                purpose="salary",
                mode=mode,
                narration=payout.narration or "",
                reference_id=f"{employee_id}_{month}",
            )
            payout.razorpay_payout_id = result.razorpay_payout_id
            payout.razorpay_fund_account_id = result.fund_account_id
            payout.razorpay_fees_paise = result.fees
            payout.razorpay_tax_paise = result.tax
            payout.status = result.status
        except Exception as e:
            logger.error("Razorpay salary payout failed: %s", str(e))
            payout.status = "failed"
            payout.failure_reason = str(e)[:500]

    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return payout


async def initiate_driver_advance(
    db: AsyncSession,
    driver_id: int,
    amount_paise: int,
    trip_id: Optional[int],
    initiated_by: int,
    driver_name: str = "",
) -> Payout:
    """Issue driver advance (typically ₹1,500). Linked to trip if provided."""
    # Check duplicate advance for same trip
    if trip_id:
        dup = await db.execute(
            select(Payout).where(
                Payout.payout_type == "advance",
                Payout.reference_type == "trip",
                Payout.reference_id == str(trip_id),
                Payout.status.in_(["pending", "processing", "processed", "queued"]),
            )
        )
        if dup.scalar_one_or_none():
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="Advance already issued for this trip.")

    contact = await _get_contact(db, driver_id, "driver")

    payout = Payout(
        payout_type="advance",
        contact_id=contact.id if contact else None,
        amount_paise=amount_paise,
        payment_method="imps",
        purpose="vendor_advance",
        narration=f"Advance - {driver_name}"[:30],
        reference_type="trip" if trip_id else "driver",
        reference_id=str(trip_id or driver_id),
        status="pending",
        initiated_by=initiated_by,
        recipient_name=driver_name,
        recipient_bank_last4=contact.bank_account_number[-4:] if contact and contact.bank_account_number else None,
    )

    if contact and contact.razorpay_fund_account_id:
        try:
            result = await rpx.create_payout(
                fund_account_id=contact.razorpay_fund_account_id,
                amount_paise=amount_paise,
                purpose="vendor_advance",
                mode="IMPS",
                narration=payout.narration or "",
                reference_id=f"adv_{driver_id}_{trip_id or 'no_trip'}",
            )
            payout.razorpay_payout_id = result.razorpay_payout_id
            payout.razorpay_fund_account_id = result.fund_account_id
            payout.status = result.status
        except Exception as e:
            logger.error("Razorpay advance payout failed: %s", str(e))
            payout.status = "failed"
            payout.failure_reason = str(e)[:500]

    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return payout


async def initiate_vendor_payment(
    db: AsyncSession,
    vendor_name: str,
    amount_paise: int,
    payment_type: str,
    description: str,
    vehicle_id: Optional[int],
    initiated_by: int,
    contact_id: Optional[int] = None,
) -> Payout:
    """For rent, insurance, tax, permits, vendor payments."""
    mode = rpx.select_mode(amount_paise, payment_type)

    contact = None
    if contact_id:
        result = await db.execute(select(PaymentContact).where(PaymentContact.id == contact_id))
        contact = result.scalar_one_or_none()

    payout = Payout(
        payout_type=payment_type,
        contact_id=contact_id,
        amount_paise=amount_paise,
        payment_method=mode.lower(),
        purpose="payout",
        narration=f"{payment_type} - {vendor_name}"[:30],
        reference_type="vehicle" if vehicle_id else "vendor",
        reference_id=str(vehicle_id or ""),
        status="pending",
        initiated_by=initiated_by,
        recipient_name=vendor_name,
        recipient_bank_last4=contact.bank_account_number[-4:] if contact and contact.bank_account_number else None,
    )

    if contact and contact.razorpay_fund_account_id:
        try:
            result = await rpx.create_payout(
                fund_account_id=contact.razorpay_fund_account_id,
                amount_paise=amount_paise,
                purpose="payout",
                mode=mode,
                narration=payout.narration or "",
            )
            payout.razorpay_payout_id = result.razorpay_payout_id
            payout.razorpay_fund_account_id = result.fund_account_id
            payout.status = result.status
        except Exception as e:
            logger.error("Razorpay vendor payout failed: %s", str(e))
            payout.status = "failed"
            payout.failure_reason = str(e)[:500]

    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return payout


async def initiate_expense_reimbursement(
    db: AsyncSession,
    expense_submission_id: int,
    initiated_by: int,
) -> Payout:
    """Reimburse an approved GPay expense back to driver's UPI."""
    result = await db.execute(
        select(ExpenseSubmission).where(ExpenseSubmission.id == expense_submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Expense submission not found.")

    contact = await _get_contact(db, sub.submitted_by, "driver")
    if not contact:
        contact = await _get_contact(db, sub.submitted_by, "staff")

    payout = Payout(
        payout_type="expense",
        contact_id=contact.id if contact else None,
        amount_paise=sub.amount_paise,
        payment_method="upi",
        purpose="reimbursement",
        narration=f"Reimburse {sub.category}"[:30],
        reference_type="expense",
        reference_id=str(sub.id),
        status="pending",
        initiated_by=initiated_by,
    )

    if contact and contact.razorpay_fund_account_id:
        try:
            rp_result = await rpx.create_payout(
                fund_account_id=contact.razorpay_fund_account_id,
                amount_paise=sub.amount_paise,
                purpose="reimbursement",
                mode="UPI",
                narration=payout.narration or "",
            )
            payout.razorpay_payout_id = rp_result.razorpay_payout_id
            payout.status = rp_result.status
        except Exception as e:
            logger.error("Razorpay reimbursement failed: %s", str(e))
            payout.status = "failed"
            payout.failure_reason = str(e)[:500]

    db.add(payout)

    # Link back to submission
    sub.payout_id = payout.id
    sub.status = "reimbursed"

    await db.commit()
    await db.refresh(payout)
    return payout


async def handle_webhook(
    db: AsyncSession,
    event: str,
    payload: dict,
) -> dict:
    """
    Handle Razorpay webhook events for payouts.
    Events: payout.processed, payout.failed, payout.reversed, payout.queued
    """
    payout_data = payload.get("payload", {}).get("payout", {}).get("entity", {})
    razorpay_id = payout_data.get("id")
    if not razorpay_id:
        return {"status": "ignored", "reason": "no payout id"}

    result = await db.execute(
        select(Payout).where(Payout.razorpay_payout_id == razorpay_id)
    )
    payout = result.scalar_one_or_none()
    if not payout:
        logger.warning("Webhook for unknown payout: %s", razorpay_id)
        return {"status": "ignored", "reason": "payout not found"}

    if event == "payout.processed":
        payout.status = "processed"
        payout.utr = payout_data.get("utr")
        payout.processed_at = datetime.utcnow()
        logger.info("Payout processed: %s UTR=%s", razorpay_id, payout.utr)
    elif event == "payout.failed":
        payout.status = "failed"
        payout.failure_reason = payout_data.get("failure_reason", "Unknown")[:500]
        logger.warning("Payout failed: %s reason=%s", razorpay_id, payout.failure_reason)
    elif event == "payout.reversed":
        payout.status = "reversed"
        logger.warning("Payout reversed: %s", razorpay_id)
    elif event == "payout.queued":
        payout.status = "queued"
    else:
        return {"status": "ignored", "reason": f"unhandled event: {event}"}

    await db.commit()
    return {"status": "ok", "payout_id": payout.id, "new_status": payout.status}
