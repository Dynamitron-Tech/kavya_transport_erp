"""Diagnose and fix the empty user_roles table by assigning roles based on users.role_name."""
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

def main():
    session = SyncSessionLocal()
    try:
        # Check user columns
        cols = session.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
        )).fetchall()
        col_names = [c[0] for c in cols]
        print("USER COLUMNS:", col_names)

        # Count tables
        ur_count = session.execute(text("SELECT COUNT(*) FROM user_roles")).scalar()
        roles_count = session.execute(text("SELECT COUNT(*) FROM roles")).scalar()
        print(f"USER_ROLES: {ur_count}, ROLES: {roles_count}")

        # Show all roles
        roles = session.execute(text("SELECT id, name FROM roles ORDER BY name")).fetchall()
        role_map = {r[1]: r[0] for r in roles}
        print("ROLES:", [(r[0], r[1]) for r in roles])

        # Check if users have role_name
        if 'role_name' in col_names:
            users = session.execute(text(
                "SELECT id, email, role_name FROM users WHERE role_name IS NOT NULL AND role_name != ''"
            )).fetchall()
            print(f"\nUsers with role_name set: {len(users)}")
            for u in users:
                print(f"  {u[1]}: {u[2]}")

            assigned = 0
            for user_id, email, role_name in users:
                role_id = role_map.get(role_name)
                if role_id:
                    existing = session.execute(text(
                        "SELECT COUNT(*) FROM user_roles WHERE user_id = :uid AND role_id = :rid"
                    ), {"uid": user_id, "rid": role_id}).scalar()
                    if not existing:
                        session.execute(text(
                            "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"
                        ), {"uid": user_id, "rid": role_id})
                        print(f"  -> Assigned {email} -> {role_name}")
                        assigned += 1
                else:
                    print(f"  WARNING: No role found for '{role_name}' (user: {email}), available: {list(role_map.keys())}")

            session.commit()
            print(f"\nDone. Assigned {assigned} user-role links.")
        else:
            print("\nNo role_name column. Assigning by email pattern...")
            email_role_map = {
                'admin@kavyatransports.com': 'admin',
                'manager@kavyatransports.com': 'manager',
                'fleet@kavyatransports.com': 'fleet_manager',
                'accountant@kavyatransports.com': 'accountant',
                'driver@kavyatransports.com': 'driver',
                'pa@kavyatransports.com': 'project_associate',
            }
            assigned = 0
            for email, role_name in email_role_map.items():
                user = session.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).scalar_one_or_none()
                role_id = role_map.get(role_name)
                if user and role_id:
                    existing = session.execute(text(
                        "SELECT COUNT(*) FROM user_roles WHERE user_id = :uid AND role_id = :rid"
                    ), {"uid": user, "rid": role_id}).scalar()
                    if not existing:
                        session.execute(text(
                            "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"
                        ), {"uid": user, "rid": role_id})
                        print(f"  -> Assigned {email} -> {role_name}")
                        assigned += 1
                    else:
                        print(f"  Already assigned: {email} -> {role_name}")
                else:
                    print(f"  Skipped {email}: user={user}, role={role_name}({role_id})")
            session.commit()
            print(f"\nDone. Assigned {assigned} user-role links.")
    except Exception as e:
        session.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        session.close()

main()
