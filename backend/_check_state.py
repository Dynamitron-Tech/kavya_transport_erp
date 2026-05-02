import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    r = s.execute(text('SELECT version_num FROM alembic_version ORDER BY version_num')).fetchall()
    print('Applied:', [v[0] for v in r])

    e = s.execute(text("SELECT typname FROM pg_type WHERE typname LIKE 'tyre%'")).fetchall()
    print('Tyre enums in DB:', [v[0] for v in e])

    t = s.execute(text(
        "SELECT tablename FROM pg_tables WHERE tablename LIKE 'tyre%' OR tablename LIKE 'vehicle_fuel%'"
    )).fetchall()
    print('Tyre/fuel tables:', [v[0] for v in t])

    col = s.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='lrs' AND column_name='transport_type'"
    )).fetchall()
    print('lrs.transport_type exists:', bool(col))
finally:
    s.close()
