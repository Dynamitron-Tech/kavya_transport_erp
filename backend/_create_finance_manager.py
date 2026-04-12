"""Create Finance Manager employee account: finance@kavyatransports.com / Finance@123"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.db.postgres.connection import SyncSessionLocal
from sqlalchemy import text
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

EMAIL = "finance@kavyatransports.com"
PASSWORD = "Finance@123"
FIRST_NAME = "Finance"
LAST_NAME = "Manager"
PHONE = "9000000005"
ROLE_NAME = "finance_manager"

s = SyncSessionLocal()
try:
    # Check if user already exists
    existing = s.execute(text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL}).fetchone()
    if existing:
        print(f"User {EMAIL} already exists (id={existing[0]}), checking role...")
        user_id = existing[0]
    else:
        # Create user
        hashed = pwd_ctx.hash(PASSWORD)
        result = s.execute(text(
            "INSERT INTO users (email, phone, password_hash, first_name, last_name, is_active, is_verified, is_deleted, created_at, updated_at) "
            "VALUES (:email, :phone, :pw, :fn, :ln, true, true, false, NOW(), NOW()) RETURNING id"
        ), {"email": EMAIL, "phone": PHONE, "pw": hashed, "fn": FIRST_NAME, "ln": LAST_NAME})
        user_id = result.fetchone()[0]
        s.commit()
        print(f"Created user {EMAIL} (id={user_id})")

    # Get role id
    role = s.execute(text("SELECT id FROM roles WHERE name = :r"), {"r": ROLE_NAME}).fetchone()
    if not role:
        print(f"ERROR: Role '{ROLE_NAME}' not found in roles table!")
        roles = s.execute(text("SELECT name FROM roles")).fetchall()
        print("Available roles:", [r[0] for r in roles])
    else:
        role_id = role[0]
        # Check if user_role already assigned
        linked = s.execute(text(
            "SELECT 1 FROM user_roles WHERE user_id = :u AND role_id = :r"
        ), {"u": user_id, "r": role_id}).fetchone()
        if linked:
            print(f"Role '{ROLE_NAME}' already assigned to user.")
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
    print(f"\nFinal: email={check[0]}, name={check[1]} {check[2]}, active={check[3]}, role={check[4]}")
finally:
    s.close()
