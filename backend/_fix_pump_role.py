import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    roles = {r[1]: r[0] for r in s.execute(text("SELECT id, name FROM roles")).fetchall()}
    print("Existing roles:", list(roles.keys()))

    # Create pump_operator role if missing
    if "pump_operator" not in roles:
        s.execute(text("""
            INSERT INTO roles (name, display_name, description, role_type, is_system, created_at, updated_at)
            VALUES ('pump_operator', 'Pump Operator', 'Manages fuel pump operations', 'PUMP_OPERATOR', true, now(), now())
        """))
        s.commit()
        pump_role_id = s.execute(text("SELECT id FROM roles WHERE name='pump_operator'")).fetchone()[0]
        roles["pump_operator"] = pump_role_id
        print(f"Created pump_operator role with id={pump_role_id}")
    else:
        print(f"pump_operator role already exists with id={roles['pump_operator']}")

    # Assign role to pump user
    pump_user = s.execute(text(
        "SELECT id, email FROM users WHERE email = 'pump@kavyatransports.com'"
    )).fetchone()
    if pump_user:
        s.execute(text(
            "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"
        ), {"uid": pump_user[0], "rid": roles["pump_operator"]})
        s.commit()
        print(f"Assigned pump_operator role to {pump_user[1]}")
    else:
        print("pump@kavyatransports.com not found")
finally:
    s.close()

