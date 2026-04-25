"""
Seed all 28 Indian States + 8 Union Territories as branches.

Usage:
    cd backend
    python seed_india_branches.py
"""
import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select, text
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.user import Branch, Tenant

import logging
logging.disable(logging.CRITICAL)

# All 28 States + 8 Union Territories of India
INDIA_STATES = [
    # States
    ("Andhra Pradesh",      "AP",   "Amaravati"),
    ("Arunachal Pradesh",   "AR",   "Itanagar"),
    ("Assam",               "AS",   "Dispur"),
    ("Bihar",               "BR",   "Patna"),
    ("Chhattisgarh",        "CG",   "Raipur"),
    ("Goa",                 "GA",   "Panaji"),
    ("Gujarat",             "GJ",   "Gandhinagar"),
    ("Haryana",             "HR",   "Chandigarh"),
    ("Himachal Pradesh",    "HP",   "Shimla"),
    ("Jharkhand",           "JH",   "Ranchi"),
    ("Karnataka",           "KA",   "Bengaluru"),
    ("Kerala",              "KL",   "Thiruvananthapuram"),
    ("Madhya Pradesh",      "MP",   "Bhopal"),
    ("Maharashtra",         "MH",   "Mumbai"),
    ("Manipur",             "MN",   "Imphal"),
    ("Meghalaya",           "ML",   "Shillong"),
    ("Mizoram",             "MZ",   "Aizawl"),
    ("Nagaland",            "NL",   "Kohima"),
    ("Odisha",              "OD",   "Bhubaneswar"),
    ("Punjab",              "PB",   "Chandigarh"),
    ("Rajasthan",           "RJ",   "Jaipur"),
    ("Sikkim",              "SK",   "Gangtok"),
    ("Tamil Nadu",          "TN",   "Chennai"),
    ("Telangana",           "TS",   "Hyderabad"),
    ("Tripura",             "TR",   "Agartala"),
    ("Uttar Pradesh",       "UP",   "Lucknow"),
    ("Uttarakhand",         "UK",   "Dehradun"),
    ("West Bengal",         "WB",   "Kolkata"),
    # Union Territories
    ("Andaman and Nicobar Islands",                 "AN",  "Port Blair"),
    ("Chandigarh",                                  "CH",  "Chandigarh"),
    ("Dadra and Nagar Haveli and Daman and Diu",    "DD",  "Daman"),
    ("Delhi",                                       "DL",  "New Delhi"),
    ("Jammu and Kashmir",                           "JK",  "Srinagar"),
    ("Ladakh",                                      "LA",  "Leh"),
    ("Lakshadweep",                                 "LD",  "Kavaratti"),
    ("Puducherry",                                  "PY",  "Puducherry"),
]


async def seed():
    async with AsyncSessionLocal() as db:
        # 1. Ensure a tenant exists
        result = await db.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        if not tenant:
            print("No tenant found — creating 'Kavya Transports' tenant...")
            tenant = Tenant(
                name="Kavya Transports",
                slug="kavya-transports",
                is_active=True,
            )
            db.add(tenant)
            await db.flush()
            print(f"  [+] Tenant created: id={tenant.id}")
        else:
            print(f"  [✓] Using existing tenant: id={tenant.id}, name={tenant.name}")

        tenant_id = tenant.id

        # 2. Update existing users that have no tenant_id
        await db.execute(
            text("UPDATE users SET tenant_id = :tid WHERE tenant_id IS NULL"),
            {"tid": tenant_id},
        )

        # 3. Seed branches (skip if code already exists)
        result = await db.execute(select(Branch.code).where(Branch.tenant_id == tenant_id))
        existing_codes = {row[0] for row in result.fetchall()}

        added = 0
        skipped = 0
        for (name, code, city) in INDIA_STATES:
            if code in existing_codes:
                skipped += 1
                continue
            branch = Branch(
                name=name,
                code=code,
                city=city,
                state=name,
                is_active=True,
                tenant_id=tenant_id,
            )
            db.add(branch)
            added += 1

        await db.commit()
        print(f"\n  [✓] Branches added:   {added}")
        print(f"  [–] Already existed:  {skipped}")
        print(f"\nDone! {added + skipped} total branches for tenant_id={tenant_id}")


if __name__ == "__main__":
    asyncio.run(seed())
