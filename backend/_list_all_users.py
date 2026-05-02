import asyncio
import sys
sys.path.insert(0, ".")
from app.db.postgres.connection import AsyncSessionLocal
from app.models.postgres.user import User
from sqlalchemy import select, text

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT u.email, u.first_name, u.last_name, u.is_active, u.phone,
                   string_agg(r.name, ', ') as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.email, u.first_name, u.last_name, u.is_active, u.phone
            ORDER BY u.email
        """))
        rows = result.fetchall()
        print(f"Total users: {len(rows)}")
        print("-" * 80)
        for r in rows:
            print(f"Email   : {r.email}")
            print(f"  Name  : {r.first_name} {r.last_name}")
            print(f"  Phone : {r.phone}")
            print(f"  Role  : {r.roles or 'N/A'}")
            print(f"  Active: {r.is_active}")
            print()

asyncio.run(main())
