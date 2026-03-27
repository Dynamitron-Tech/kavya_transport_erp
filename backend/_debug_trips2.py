from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

session = SyncSessionLocal()

print("=== All drivers ===")
drivers = session.execute(text('SELECT id, user_id, first_name, last_name FROM drivers')).fetchall()
for d in drivers:
    print(f'  id={d[0]}, user_id={d[1]}, name={d[2]} {d[3]}')
if not drivers:
    print('  No drivers found')

print("\n=== All trips ===")
trips = session.execute(text('SELECT id, status, driver_id, created_at FROM trips ORDER BY id DESC LIMIT 10')).fetchall()
for t in trips:
    print(f'  id={t[0]}, status={t[1]}, driver_id={t[2]}, created={t[3]}')
if not trips:
    print('  No trips found')

print("\n=== User id=6 ===")
users = session.execute(text('SELECT id, email, full_name FROM users WHERE id = 6')).fetchall()
for u in users:
    print(f'  id={u[0]}, email={u[1]}, name={u[2]}')

print("\n=== Tables with 'config' in name ===")
tables = session.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%config%'")).fetchall()
for t in tables:
    print(f'  {t[0]}')
if not tables:
    print('  None')

print("\n=== intelligence tables ===")
tables2 = session.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%intelligence%' OR tablename LIKE '%system%'")).fetchall()
for t in tables2:
    print(f'  {t[0]}')
if not tables2:
    print('  None')

session.close()
