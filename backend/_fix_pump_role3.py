import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

s = SyncSessionLocal()
try:
    # First check existing role_type values
    rows = s.execute(text("SELECT name, role_type::text FROM roles ORDER BY id")).fetchall()
    print("Existing roles and types:")
    for r in rows:
        print(f"  {r[0]:25} => '{r[1]}'")

    # Check the PostgreSQL enum values for roletype
    try:
        enum_vals = s.execute(text(
            "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
            "WHERE t.typname = 'roletype'"
        )).fetchall()
        print("roletype enum values:", [v[0] for v in enum_vals])

        # Add PUMP_OPERATOR if missing
        if not any(v[0] == 'PUMP_OPERATOR' for v in enum_vals):
            s.execute(text("ALTER TYPE roletype ADD VALUE 'PUMP_OPERATOR'"))
            s.commit()
            print("Added PUMP_OPERATOR to roletype enum")
    except Exception as e:
        print(f"Enum check failed: {e}")

    # Now try inserting the role
    pump_role = s.execute(text("SELECT id FROM roles WHERE name='pump_operator'")).fetchone()
    if not pump_role:
        s.execute(text("""
            INSERT INTO roles (name, display_name, description, role_type, is_system, created_at, updated_at)
            VALUES ('pump_operator', 'Pump Operator', 'Manages fuel pump operations', 'PUMP_OPERATOR', true, now(), now())
        """))
        s.commit()
        pump_role = s.execute(text("SELECT id FROM roles WHERE name='pump_operator'")).fetchone()
        print(f"Created pump_operator role id={pump_role[0]}")
    else:
        print(f"pump_operator role already exists id={pump_role[0]}")

    if pump_role:
        pump_user = s.execute(text("SELECT id FROM users WHERE email='pump@kavyatransports.com'")).fetchone()
        if pump_user:
            s.execute(text(
                "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid) ON CONFLICT DO NOTHING"
            ), {"uid": pump_user[0], "rid": pump_role[0]})
            s.commit()
            print(f"Assigned pump_operator to pump user id={pump_user[0]}")
except Exception as e:
    print(f"Error: {e}")
    s.rollback()
finally:
    s.close()
