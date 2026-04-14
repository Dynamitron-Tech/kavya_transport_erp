"""Fix alembic head: q001 is now superseded by r001_tyre_field_tables"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    # q001 is the parent of r001_tyre_field_tables which is already marked applied.
    # Remove q001 from the heads table since r001_tyre_field_tables supersedes it.
    s.execute(text("DELETE FROM alembic_version WHERE version_num = 'q001_add_dl_fields'"))
    s.commit()
    r = s.execute(text('SELECT version_num FROM alembic_version ORDER BY version_num')).fetchall()
    print('Applied heads:', [v[0] for v in r])
finally:
    s.close()
