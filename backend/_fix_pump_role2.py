import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    # Check what role_type values exist
    rows = s.execute(text("SELECT name, role_type FROM roles ORDER BY id")).fetchall()
    print("Current role_type values in DB:")
    for r in rows:
        print(f"  {r[0]:25} => {r[1]}")

    # Try to create pump_operator role with the correct value
    # Use same case as other roles
    s.execute(text("""
        INSERT INTO roles (name, display_name, description, role_type, is_system, created_at, updated_at)
        VALUES ('pump_operator', 'Pump Operator', 'Manages fuel pump operations', 'PUMP_OPERATOR', true, now(), now())
        ON CONFLICT (name) DO NOTHING
    """))
    s.commit()

    pump_role = s.execute(text("SELECT id FROM roles WHERE name='pump_operator'")).fetchone()
    if pump_role:
        pump_user = s.execute(text(
            "SELECT id FROM users WHERE email='pump@kavyatransports.com'"
        )).fetchone()
        if pump_user:
            s.execute(text(
                "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"
            ), {"uid": pump_user[0], "rid": pump_role[0]})
            s.commit()
            print("pump_operator role created and assigned to pump user")
        else:
            print("pump user not found")
    else:
        print("Failed to create pump_operator role")
except Exception as e:
    print(f"Error: {e}")
    s.rollback()
finally:
    s.close()
