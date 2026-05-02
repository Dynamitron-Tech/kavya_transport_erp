import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
rows = s.execute(text(
    "SELECT email, first_name, last_name, phone, is_active, employee_id "
    "FROM users ORDER BY id"
)).fetchall()
print(f"Total users: {len(rows)}")
for r in rows:
    last = r[2] or ""
    phone = r[3] or "(none)"
    eid = r[5] or "(none)"
    print(f"  {r[0]:45} | {r[1]} {last} | phone={phone} | active={r[4]} | eid={eid}")
s.close()
