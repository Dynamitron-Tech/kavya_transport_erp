"""Check DB state for market_trips and lrs tables"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    tables = s.execute(text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name IN ('market_trips','lrs')"
    )).fetchall()
    print("Tables:", [t[0] for t in tables])

    lrs_transport = s.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='lrs' AND column_name='transport_type'"
    )).fetchall()
    print("lrs.transport_type exists:", bool(lrs_transport))

    mt_cols = s.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='market_trips' ORDER BY ordinal_position"
    )).fetchall()
    print("market_trips columns:", [c[0] for c in mt_cols])
finally:
    s.close()
