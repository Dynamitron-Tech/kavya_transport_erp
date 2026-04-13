"""
Remove the inactive test/dev users left over from development testing.
Also removes clearly-test active users (non-company emails).
Keeps: @kavyatransports.com users only (the real ones).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

KEEP_DOMAINS = ['kavyatransports.com']

s = SyncSessionLocal()
try:
    # List all users
    rows = s.execute(text(
        "SELECT id, email, first_name, is_active FROM users ORDER BY id"
    )).fetchall()

    delete_ids = []
    keep_ids = []
    for row in rows:
        email = row[1] or ''
        domain = email.split('@')[-1] if '@' in email else ''
        if domain in KEEP_DOMAINS:
            keep_ids.append(row)
        else:
            delete_ids.append(row)

    print(f"\nKeeping {len(keep_ids)} company users:")
    for r in keep_ids:
        print(f"  [KEEP] id={r[0]} | {r[1]} | active={r[3]}")

    print(f"\nRemoving {len(delete_ids)} non-company users:")
    for r in delete_ids:
        print(f"  [DEL]  id={r[0]} | {r[1]} | active={r[3]}")

    if delete_ids:
        ids = [r[0] for r in delete_ids]
        # Deactivate instead of delete — some test users have trips/drivers linked
        s.execute(text("UPDATE users SET is_active = false WHERE id = ANY(:ids)"), {"ids": ids})
        s.commit()
        print(f"\nDeactivated {len(delete_ids)} test users (hidden from employees list).")
    else:
        print("\nNothing to deactivate.")
finally:
    s.close()
