"""Check which columns are missing from market_trips and lrs tables"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    for table in ('market_trips', 'lrs'):
        cols = s.execute(text(
            f"SELECT column_name, data_type FROM information_schema.columns "
            f"WHERE table_name='{table}' ORDER BY ordinal_position"
        )).fetchall()
        print(f"\n--- {table} ---")
        for c in cols:
            print(f"  {c[0]:40s} {c[1]}")
finally:
    s.close()
