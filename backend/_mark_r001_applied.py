"""Mark r001_tyre_field_tables as applied since tables already exist in DB"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    s.execute(text("INSERT INTO alembic_version (version_num) VALUES ('r001_tyre_field_tables')"))
    s.commit()
    r = s.execute(text('SELECT version_num FROM alembic_version ORDER BY version_num')).fetchall()
    print('Applied:', [v[0] for v in r])
finally:
    s.close()
