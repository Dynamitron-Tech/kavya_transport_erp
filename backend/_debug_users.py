from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text
s = SyncSessionLocal()
rows = s.execute(text('SELECT id, email FROM users ORDER BY id')).fetchall()
for r in rows:
    print(f'id={r[0]}, email={r[1]}')
s.close()
