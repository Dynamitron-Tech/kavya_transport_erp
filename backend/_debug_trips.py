from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

session = SyncSessionLocal()

# Find driver record for user_id=6
drivers = session.execute(text('SELECT id, user_id, first_name, last_name FROM drivers WHERE user_id = 6')).fetchall()
for d in drivers:
    print(f'Driver: id={d[0]}, user_id={d[1]}, name={d[2]} {d[3]}')

# Find trips for this driver
if drivers:
    did = drivers[0][0]
    trips = session.execute(text(f'SELECT id, status, driver_id FROM trips WHERE driver_id = {did} ORDER BY id DESC LIMIT 10')).fetchall()
    for t in trips:
        print(f'  Trip: id={t[0]}, status={t[1]}, driver_id={t[2]}')
    if not trips:
        print('  No trips found for this driver')
        all_trips = session.execute(text('SELECT id, status, driver_id FROM trips ORDER BY id DESC LIMIT 10')).fetchall()
        print('  All trips:')
        for t in all_trips:
            print(f'    Trip: id={t[0]}, status={t[1]}, driver_id={t[2]}')

# Also check config table
print("\nConfig keys matching 'expense':")
try:
    configs = session.execute(text("SELECT key, value FROM system_config WHERE key LIKE '%expense%'")).fetchall()
    for c in configs:
        print(f'  {c[0]} = {c[1]}')
    if not configs:
        print('  None found')
except Exception as e:
    print(f'  Error querying system_config: {e}')

# Check if system_config table even exists
print("\nAll config tables:")
try:
    tables = session.execute(text("SELECT tablename FROM pg_tables WHERE tablename LIKE '%config%'")).fetchall()
    for t in tables:
        print(f'  {t[0]}')
    if not tables:
        print('  No config tables found')
except Exception as e:
    print(f'  Error: {e}')

session.close()
