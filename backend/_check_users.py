"""Check users and create finance manager if missing"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    rows = s.execute(text(
        "SELECT u.email, u.full_name, u.is_active, r.name as role "
        "FROM users u "
        "LEFT JOIN user_roles ur ON ur.user_id=u.id "
        "LEFT JOIN roles r ON r.id=ur.role_id "
        "ORDER BY u.email"
    )).fetchall()
    print("Current users:")
    for row in rows:
        print(f"  {row[0]} | {row[1]} | active={row[2]} | role={row[3]}")

    # Check if finance user exists
    fin = s.execute(text("SELECT id FROM users WHERE email='finance@kavyatransports.com'")).fetchone()
    print(f"\nfinance@kavyatransports.com exists: {bool(fin)}")
    if fin:
        print(f"  user id: {fin[0]}")
finally:
    s.close()
