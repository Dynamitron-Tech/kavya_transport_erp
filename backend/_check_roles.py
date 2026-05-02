import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
rows = s.execute(text("""
SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.is_active = true
ORDER BY u.id
""")).fetchall()
print("Active users and roles:")
for r in rows:
    last = r[3] or ""
    role = r[4] or "(none)"
    print(f"  id={r[0]:3} | {r[1]:45} | {r[2]} {last} | role={role}")
s.close()
