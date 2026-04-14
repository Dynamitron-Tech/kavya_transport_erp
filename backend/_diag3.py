import asyncio, sys, os, json, traceback
sys.path.insert(0, '.')

# Simulate the exact HTTP endpoint - but with full error capture
async def test():
    from app.db.postgres.connection import AsyncSessionLocal
    from app.models.postgres.vehicle import (
        VehicleTyre, TyreReading, TyreReadingCondition, TyreAlert,
        TyreAlertType, TyreAlertSeverity, TyreAlertStatus, TyreThreshold
    )
    from sqlalchemy import select
    from datetime import datetime

    # Exact payload from the screenshot
    payload = {
        "vehicle_id": None,   # We'll fix this below - first find a valid vehicle
        "position": "2R1",
        "psi": 32.0,
        "tread_depth_mm": 1.0,
        "temperature_c": 32.0,
        "odometer_at_reading": 70100.0,
        "condition": "GOOD",
        "notes": "",
        "reading_date": "2026-04-13",
    }

    async with AsyncSessionLocal() as db:
        # Find any vehicle that has tyres
        from app.models.postgres.vehicle import Vehicle
        result = await db.execute(select(Vehicle).limit(1))
        vehicle = result.scalar_one_or_none()
        if not vehicle:
            print("ERROR: No vehicles in DB!")
            return
        payload["vehicle_id"] = vehicle.id
        print(f"Using vehicle_id={vehicle.id}")

        # Now run the exact endpoint logic
        vehicle_id = payload.get("vehicle_id")
        position = payload.get("position")
        psi = payload.get("psi")

        print(f"vehicle_id={vehicle_id} ({type(vehicle_id)}), position={position}, psi={psi}")

        if not vehicle_id or not position or psi is None:
            print("422 - missing field")
            return

        try:
            tyre_result = await db.execute(
                select(VehicleTyre).where(
                    VehicleTyre.vehicle_id == vehicle_id,
                    VehicleTyre.position == position,
                    VehicleTyre.is_active == True,
                ).limit(1)
            )
            tyre = tyre_result.scalar_one_or_none()
            print(f"tyre found: {tyre}")

            condition_raw = str(payload.get("condition", "GOOD")).upper()
            condition_enum = TyreReadingCondition[condition_raw]
            print(f"condition_enum: {condition_enum}")

            reading = TyreReading(
                vehicle_tyre_id=tyre.id if tyre else None,
                vehicle_id=vehicle_id,
                position=position,
                psi=psi,
                tread_depth_mm=payload.get("tread_depth_mm"),
                condition=condition_enum,
                temperature_c=payload.get("temperature_c"),
                notes=payload.get("notes"),
                photo_url=payload.get("photo_url"),
                driver_id=payload.get("driver_id") or 1,  # simulate user_id=1
                odometer_at_reading=payload.get("odometer_at_reading"),
            )
            db.add(reading)

            if tyre:
                tyre.last_psi = psi
                if payload.get("tread_depth_mm"):
                    tyre.tread_depth_mm = payload["tread_depth_mm"]
                tyre.last_reading_at = datetime.utcnow()

            await db.flush()
            print(f"Reading flush OK, id={reading.id}")

            # _get_threshold
            t_result = await db.execute(
                select(TyreThreshold).where(TyreThreshold.vehicle_id == vehicle_id).limit(1)
            )
            threshold_obj = t_result.scalar_one_or_none()
            if not threshold_obj:
                t_result2 = await db.execute(
                    select(TyreThreshold).where(TyreThreshold.vehicle_id == None).limit(1)
                )
                threshold_obj = t_result2.scalar_one_or_none()

            threshold = {
                "min_psi": float(threshold_obj.min_psi or 80) if threshold_obj else 80.0,
                "critical_psi": float(threshold_obj.critical_psi or 60) if threshold_obj else 60.0,
                "min_tread_mm": float(threshold_obj.min_tread_mm or 3.0) if threshold_obj else 3.0,
                "worn_tread_mm": float(threshold_obj.worn_tread_mm or 1.6) if threshold_obj else 1.6,
            }
            print(f"threshold={threshold}")

            # _auto_create_alerts
            psi_f = float(reading.psi or 0)
            tread_f = float(reading.tread_depth_mm or 0) if reading.tread_depth_mm else None
            condition_str = str(reading.condition.value if hasattr(reading.condition, 'value') else reading.condition)
            print(f"psi_f={psi_f}, tread_f={tread_f}, condition_str={condition_str}")

            alerts_to_create = []
            if psi_f > 0 and psi_f < threshold["critical_psi"]:
                alerts_to_create.append((TyreAlertType.CRITICAL_PSI, TyreAlertSeverity.CRITICAL, psi_f, threshold["critical_psi"]))
            elif psi_f > 0 and psi_f < threshold["min_psi"]:
                alerts_to_create.append((TyreAlertType.LOW_PSI, TyreAlertSeverity.WARNING, psi_f, threshold["min_psi"]))

            if tread_f is not None and tread_f > 0:
                if tread_f < threshold["worn_tread_mm"]:
                    alerts_to_create.append((TyreAlertType.WORN, TyreAlertSeverity.CRITICAL, tread_f, threshold["worn_tread_mm"]))
                elif tread_f < threshold["min_tread_mm"]:
                    alerts_to_create.append((TyreAlertType.LOW_TREAD, TyreAlertSeverity.WARNING, tread_f, threshold["min_tread_mm"]))

            print(f"alerts_to_create: {len(alerts_to_create)}")

            for alert_type, severity, current_val, threshold_val in alerts_to_create:
                existing = await db.execute(
                    select(TyreAlert).where(
                        TyreAlert.vehicle_id == reading.vehicle_id,
                        TyreAlert.position == reading.position,
                        TyreAlert.alert_type == alert_type,
                        TyreAlert.status == TyreAlertStatus.OPEN,
                    ).limit(1)
                )
                if not existing.scalar_one_or_none():
                    db.add(TyreAlert(
                        vehicle_tyre_id=tyre.id if tyre else None,
                        vehicle_id=reading.vehicle_id,
                        position=reading.position,
                        alert_type=alert_type,
                        severity=severity,
                        current_value=current_val,
                        threshold_value=threshold_val,
                        status=TyreAlertStatus.OPEN,
                        source="field",
                    ))

            await db.flush()
            print("Alert flush OK")
            await db.commit()
            print("COMMIT OK")

        except Exception:
            traceback.print_exc()
            await db.rollback()

asyncio.run(test())
