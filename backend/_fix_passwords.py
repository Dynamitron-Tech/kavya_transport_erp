import asyncio

async def main():
    from app.db.postgres.connection import get_db
    from app.core.security import get_password_hash
    from sqlalchemy import text

    updates = [
        ('manager@kavyatransports.com', 'manager123'),
        ('fleet@kavyatransports.com', 'fleet123'),
        ('accountant@kavyatransports.com', 'accountant123'),
        ('pa@kavyatransports.com', 'pa123456'),
        ('driver@kavyatransports.com', 'driver123'),
        ('admin@kavyatransports.com', 'admin123'),
        ('finance@kavyatransports.com', 'Finance@123'),
    ]

    async for db in get_db():
        # Update existing passwords
        for email, pwd in updates:
            h = get_password_hash(pwd)
            await db.execute(text('UPDATE users SET password_hash=:h WHERE email=:e'), {'h': h, 'e': email})
            print(f'Updated: {email}')

        # Check if pump user exists
        r = await db.execute(text("SELECT id FROM users WHERE email='pump@kavyatransports.com'"))
        pump = r.fetchone()
        h = get_password_hash('pump123')
        if not pump:
            await db.execute(text("""
                INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified, is_deleted, created_at, updated_at)
                VALUES ('pump@kavyatransports.com', :h, 'Pump', 'Operator', true, true, false, NOW(), NOW())
            """), {'h': h})
            print('Created: pump@kavyatransports.com')

            rr = await db.execute(text("SELECT id FROM roles WHERE LOWER(name)='pump_operator' LIMIT 1"))
            role = rr.fetchone()
            if role:
                uid = await db.execute(text("SELECT id FROM users WHERE email='pump@kavyatransports.com'"))
                uid = uid.fetchone()[0]
                await db.execute(text('INSERT INTO user_roles (user_id, role_id) VALUES (:u, :r) ON CONFLICT DO NOTHING'), {'u': uid, 'r': role[0]})
                print('Assigned pump_operator role')
        else:
            await db.execute(text('UPDATE users SET password_hash=:h WHERE email=:e'), {'h': h, 'e': 'pump@kavyatransports.com'})
            print('Updated: pump@kavyatransports.com')

        await db.commit()
        print('ALL DONE')
        break

asyncio.run(main())
