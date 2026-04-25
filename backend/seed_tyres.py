"""Seed tyre data across all existing vehicles.

Creates realistic tyres (6 per truck), lifecycle events, sensor readings,
and some retreading records so that all 5 Tyre Management tabs have data.

Usage:
    cd backend
    python seed_tyres.py
"""
import asyncio
import sys
import os
import random
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.vehicle import Vehicle, VehicleTyre, TyreLifecycleEvent, TyreSensorReading

BRANDS = ["Apollo", "MRF", "Ceat", "JK Tyres", "Michelin", "Bridgestone"]
SIZES = ["10.00R20", "11.00R20", "295/80R22.5", "315/80R22.5", "12.00R24"]
POSITIONS_6 = ["FL", "FR", "RL1", "RR1", "RL2", "RR2"]
POSITIONS_10 = ["FL", "FR", "RL1", "RR1", "RL2", "RR2", "RL3", "RR3", "RL4", "RR4"]
POSITIONS_4 = ["FL", "FR", "RL1", "RR1"]

# Map vehicle type to correct tyre positions
VEHICLE_TYPE_POSITIONS = {
    "LCV": POSITIONS_4,
    "MINI_TRUCK": POSITIONS_4,
    "TRUCK": POSITIONS_6,
    "TANKER": POSITIONS_10,
    "CONTAINER": POSITIONS_10,
    "TRAILER": POSITIONS_10,
}

VENDORS = ["Sri Balaji Tyres, Coimbatore", "National Tyres, Chennai", "Laxmi Retreads, Madurai", "VR Tyre Works, Salem"]


async def seed_tyres():
    async with AsyncSessionLocal() as db:
        # Check if tyres already exist
        count = (await db.execute(select(func.count()).select_from(VehicleTyre))).scalar()
        if count and count > 10:
            print(f"[SKIP] Already {count} tyres in database. Delete first if you want to reseed.")
            return

        # Get all vehicles
        vehicles = (await db.execute(select(Vehicle))).scalars().all()
        if not vehicles:
            print("[ERROR] No vehicles found. Run seed_data.py first.")
            return

        print(f"[INFO] Found {len(vehicles)} vehicles. Seeding tyres...")

        tyre_serial = 1000
        all_tyres = []

        for v in vehicles:
            vtype = (v.vehicle_type or "TRUCK").upper()
            positions = VEHICLE_TYPE_POSITIONS.get(vtype, POSITIONS_6)
            brand = random.choice(BRANDS)
            size = random.choice(SIZES)

            for pos in positions:
                tyre_serial += 1
                serial_no = f"TYR-{brand[:3].upper()}-{tyre_serial}"

                # Randomise tyre age and km
                days_old = random.randint(30, 600)
                purchase_dt = date.today() - timedelta(days=days_old)
                km_at_fit = random.randint(10000, 80000)
                km_run = random.randint(5000, 70000)
                current_km = km_at_fit + km_run

                # Condition distribution
                roll = random.random()
                if roll < 0.50:
                    condition = "good"
                elif roll < 0.70:
                    condition = "new"
                elif roll < 0.82:
                    condition = "average"
                elif roll < 0.88:
                    condition = "worn"
                elif roll < 0.93:
                    condition = "retreading"
                elif roll < 0.97:
                    condition = "removed"
                else:
                    condition = "scrapped"

                # Retread tracking
                retread_count = 0
                last_retread_date = None
                total_retread_cost = Decimal("0")
                if condition == "retreading":
                    retread_count = random.randint(0, 1)
                    last_retread_date = date.today() - timedelta(days=random.randint(1, 15))
                    total_retread_cost = Decimal(str(random.randint(3000, 6000)))
                elif random.random() < 0.25:
                    retread_count = random.randint(1, 2)
                    last_retread_date = date.today() - timedelta(days=random.randint(30, 200))
                    total_retread_cost = Decimal(str(retread_count * random.randint(3000, 5500)))

                # TPMS sensor (70% of tyres have sensors)
                sensor_id = f"SENS-{tyre_serial}" if random.random() < 0.70 else None
                psi = round(random.uniform(28, 36), 1) if sensor_id else None
                temp = round(random.uniform(35, 75), 1) if sensor_id else None
                tread = round(random.uniform(3.0, 14.0), 1) if sensor_id else None

                # Some low-PSI / high-temp cases for alerts
                if sensor_id and random.random() < 0.12:
                    psi = round(random.uniform(18, 25), 1)
                if sensor_id and random.random() < 0.08:
                    temp = round(random.uniform(85, 105), 1)

                tyre = VehicleTyre(
                    vehicle_id=v.id,
                    tyre_number=serial_no,
                    position=pos,
                    brand=brand,
                    size=size,
                    purchase_date=purchase_dt,
                    purchase_cost=Decimal(str(random.randint(8000, 22000))),
                    km_at_fitment=Decimal(str(km_at_fit)),
                    current_km=Decimal(str(current_km)),
                    condition=condition,
                    is_active=True,
                    retread_count=retread_count,
                    max_retreads=random.choice([2, 3]),
                    last_retread_date=last_retread_date,
                    total_retread_cost=total_retread_cost,
                    sensor_id=sensor_id,
                    last_psi=Decimal(str(psi)) if psi else None,
                    last_temperature_c=Decimal(str(temp)) if temp else None,
                    tread_depth_mm=Decimal(str(tread)) if tread else None,
                    last_reading_at=datetime.utcnow() - timedelta(minutes=random.randint(5, 120)) if sensor_id else None,
                )
                db.add(tyre)
                all_tyres.append(tyre)

        await db.flush()  # Assign IDs
        print(f"[OK] Created {len(all_tyres)} tyres across {len(vehicles)} vehicles")

        # ── Lifecycle events ──
        event_count = 0
        for tyre in all_tyres:
            # MOUNTED event for every tyre
            db.add(TyreLifecycleEvent(
                vehicle_tyre_id=tyre.id,
                event_type="MOUNTED",
                odometer_km=tyre.km_at_fitment,
                notes=f"Initial fitment at position {tyre.position}",
            ))
            event_count += 1

            # Retread events
            for i in range(tyre.retread_count):
                vendor = random.choice(VENDORS)
                cost = Decimal(str(random.randint(3000, 5500)))
                db.add(TyreLifecycleEvent(
                    vehicle_tyre_id=tyre.id,
                    event_type="RETREAD",
                    odometer_km=Decimal(str(int(float(tyre.km_at_fitment or 0)) + random.randint(20000, 50000))),
                    cost=cost,
                    vendor_name=vendor,
                    notes=f"Retread #{i+1} at {vendor}",
                ))
                event_count += 1

            # Extra events for retreading tyres
            if tyre.condition == "retreading":
                db.add(TyreLifecycleEvent(
                    vehicle_tyre_id=tyre.id,
                    event_type="RETREAD",
                    odometer_km=tyre.current_km,
                    cost=Decimal(str(random.randint(3500, 5000))),
                    vendor_name=random.choice(VENDORS),
                    notes="Sent for retreading",
                ))
                event_count += 1

            # Rotation events for ~20% of tyres
            if random.random() < 0.20:
                new_pos = random.choice(POSITIONS_6)
                db.add(TyreLifecycleEvent(
                    vehicle_tyre_id=tyre.id,
                    event_type="ROTATED",
                    odometer_km=Decimal(str(int(float(tyre.km_at_fitment or 0)) + random.randint(10000, 30000))),
                    notes=f"Rotated from {tyre.position} to {new_pos}",
                ))
                event_count += 1

        print(f"[OK] Created {event_count} lifecycle events")

        # ── Sensor readings (last 24h for tyres with sensors) ──
        reading_count = 0
        sensor_tyres = [t for t in all_tyres if t.sensor_id]
        for tyre in sensor_tyres:
            base_psi = float(tyre.last_psi or 32)
            base_temp = float(tyre.last_temperature_c or 50)
            # 6–12 readings over the last 24 hours
            num_readings = random.randint(6, 12)
            for j in range(num_readings):
                ts = datetime.utcnow() - timedelta(hours=random.uniform(0.5, 24))
                psi_val = round(base_psi + random.uniform(-3, 3), 1)
                temp_val = round(base_temp + random.uniform(-8, 8), 1)
                tread_val = round(float(tyre.tread_depth_mm or 8) + random.uniform(-0.5, 0.2), 1)

                alert_triggered = False
                alert_type = None
                if psi_val < 25:
                    alert_triggered = True
                    alert_type = "underinflated"
                elif temp_val > 85:
                    alert_triggered = True
                    alert_type = "high_temp"

                db.add(TyreSensorReading(
                    vehicle_tyre_id=tyre.id,
                    psi=Decimal(str(max(psi_val, 10))),
                    temperature_c=Decimal(str(max(temp_val, 20))),
                    tread_depth_mm=Decimal(str(max(tread_val, 1))),
                    timestamp=ts,
                    alert_triggered=alert_triggered,
                    alert_type=alert_type,
                ))
                reading_count += 1

        print(f"[OK] Created {reading_count} sensor readings")

        await db.commit()
        print("\n[DONE] Tyre seed data complete!")
        print(f"  Tyres:     {len(all_tyres)}")
        print(f"  Events:    {event_count}")
        print(f"  Readings:  {reading_count}")

        # Summary
        conditions = {}
        for t in all_tyres:
            conditions[t.condition] = conditions.get(t.condition, 0) + 1
        print(f"  Conditions: {conditions}")
        retreading = sum(1 for t in all_tyres if t.condition == "retreading")
        retreaded = sum(1 for t in all_tyres if t.retread_count > 0)
        print(f"  Retreading: {retreading}, Previously retreaded: {retreaded}")


if __name__ == "__main__":
    asyncio.run(seed_tyres())
