"""Create finance_manager role and assign to finance@kavyatransports.com"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text

EMAIL = "finance@kavyatransports.com"
ROLE_NAME = "finance_manager"

s = SyncSessionLocal()
try:
    # Create the role if it doesn't exist
    existing_role = s.execute(text("SELECT id FROM roles WHERE name = :r"), {"r": ROLE_NAME}).fetchone()
    if existing_role:
        role_id = existing_role[0]
        print(f"Role '{ROLE_NAME}' already exists (id={role_id})")
    else:
        result = s.execute(text(
            "INSERT INTO roles (name, display_name, role_type, description, created_at, updated_at) "
            "VALUES (:name, :dname, :rtype, :desc, NOW(), NOW()) RETURNING id"
        ), {"name": ROLE_NAME, "dname": "Finance Manager", "rtype": "FINANCE_MANAGER", "desc": "Finance Manager - manages invoices, banking and payments"})
        role_id = result.fetchone()[0]
        s.commit()
        print(f"Created role '{ROLE_NAME}' (id={role_id})")

    # Get user
    user = s.execute(text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL}).fetchone()
    if not user:
        print(f"ERROR: User {EMAIL} not found!")
    else:
        user_id = user[0]
        # Link role to user
        linked = s.execute(text(
            "SELECT 1 FROM user_roles WHERE user_id = :u AND role_id = :r"
        ), {"u": user_id, "r": role_id}).fetchone()
        if linked:
            print(f"Role already assigned to user {EMAIL}")
        else:
            s.execute(text(
                "INSERT INTO user_roles (user_id, role_id) VALUES (:u, :r)"
            ), {"u": user_id, "r": role_id})
            s.commit()
            print(f"Assigned role '{ROLE_NAME}' to {EMAIL}")

    # Verify
    check = s.execute(text(
        "SELECT u.email, u.first_name, u.last_name, u.is_active, r.name "
        "FROM users u "
        "JOIN user_roles ur ON ur.user_id = u.id "
        "JOIN roles r ON r.id = ur.role_id "
        "WHERE u.email = :e"
    ), {"e": EMAIL}).fetchone()
    if check:
        print(f"\nFinal: email={check[0]}, name={check[1]} {check[2]}, active={check[3]}, role={check[4]}")
    else:
        print("Verification failed - no result")
finally:
    s.close()
