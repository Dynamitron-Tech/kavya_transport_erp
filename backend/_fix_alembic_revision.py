"""Fix Alembic revision mismatch: rename n001_client_market_cols -> n001_client_market_trip_cols"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

OLD = "n001_client_market_cols"
NEW = "n001_client_market_trip_cols"

s = SyncSessionLocal()
try:
    before = s.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num")).fetchall()
    print("Before:", [v[0] for v in before])

    result = s.execute(
        text("UPDATE alembic_version SET version_num = :new WHERE version_num = :old"),
        {"new": NEW, "old": OLD}
    )
    s.commit()
    print(f"Rows updated: {result.rowcount}")

    after = s.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num")).fetchall()
    print("After:", [v[0] for v in after])
finally:
    s.close()
