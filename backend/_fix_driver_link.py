"""
Fix: Link driver@kavyatransports.com (user_id=7) to a driver record.
Run on EC2: /home/ubuntu/kavya_erp/backend/venv/bin/python3 /tmp/_fix_driver_link.py
"""
import os, sys

# Load .env
env_path = os.path.join(os.path.dirname(__file__) or '.', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

import psycopg2

host = os.environ.get('POSTGRES_HOST', 'database-1.cja60iaay252.ap-south-1.rds.amazonaws.com')
port = os.environ.get('POSTGRES_PORT', '5432')
user = os.environ.get('POSTGRES_USER', 'postgres')
password = os.environ.get('POSTGRES_PASSWORD', 'Kavyatransport2004')
db = os.environ.get('POSTGRES_DB', 'postgres')

print(f"Connecting to {host}:{port}/{db} as {user}")
conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=db)
cur = conn.cursor()

# 1. Show user record
cur.execute("SELECT id, email, phone, first_name, last_name FROM users WHERE email='driver@kavyatransports.com'")
user_row = cur.fetchone()
print(f"\nUser record: {user_row}")
if not user_row:
    print("ERROR: User not found!")
    sys.exit(1)
user_id = user_row[0]
user_email = user_row[1]
user_phone = user_row[2]

# 2. Check if already linked
cur.execute("SELECT id, first_name, last_name, employee_code, user_id FROM drivers WHERE user_id=%s AND is_deleted=false", (user_id,))
already = cur.fetchone()
if already:
    print(f"\nDriver already linked: {already}")
    conn.close()
    sys.exit(0)

# 3. Try matching by email
cur.execute("SELECT id, first_name, last_name, employee_code, phone, email, user_id FROM drivers WHERE is_deleted=false AND (email=%s OR phone=%s)", (user_email, user_phone))
by_email_or_phone = cur.fetchall()
print(f"\nDrivers matching email/phone: {by_email_or_phone}")

if by_email_or_phone:
    driver = by_email_or_phone[0]
    driver_id = driver[0]
    print(f"\nLinking driver id={driver_id} ({driver[1]} {driver[2]}) to user_id={user_id}")
    cur.execute("UPDATE drivers SET user_id=%s WHERE id=%s", (user_id, driver_id))
    conn.commit()
    print("Done - linked existing driver record.")
else:
    # 4. Check for any Karthik driver
    cur.execute("SELECT id, first_name, last_name, employee_code, phone, email, user_id FROM drivers WHERE is_deleted=false AND (first_name ILIKE 'karthik%' OR first_name='Karthik') ORDER BY id LIMIT 5")
    karthiks = cur.fetchall()
    print(f"\nKarthik drivers: {karthiks}")
    
    if karthiks:
        # Use first Karthik driver
        driver = karthiks[0]
        driver_id = driver[0]
        print(f"\nLinking Karthik driver id={driver_id} ({driver[1]} {driver[2]}) to user_id={user_id}")
        cur.execute("UPDATE drivers SET user_id=%s, email=%s WHERE id=%s", (user_id, user_email, driver_id))
        conn.commit()
        print("Done - linked Karthik driver record.")
    else:
        # 5. Create a new driver record for this user
        print(f"\nNo existing driver found. Creating new driver record for user_id={user_id}...")
        cur.execute("""
            INSERT INTO drivers (
                employee_code, first_name, last_name, email, phone,
                license_number, license_expiry, user_id,
                experience_years, monthly_salary, is_active, is_deleted, created_at, updated_at
            ) VALUES (
                'KTD-AUTO-001', 'Karthik', 'Vel', %s, %s,
                'DL-DEMO-001', '2028-12-31', %s,
                3, 18000, true, false, NOW(), NOW()
            ) RETURNING id
        """, (user_email, user_phone or '9876510005', user_id))
        new_id = cur.fetchone()[0]
        conn.commit()
        print(f"Done - created new driver record id={new_id}.")

# 6. Verify
cur.execute("SELECT id, first_name, last_name, employee_code, user_id, email FROM drivers WHERE user_id=%s", (user_id,))
result = cur.fetchone()
print(f"\nFinal driver record linked to user_id={user_id}: {result}")

conn.close()
print("\nScript complete. Restart service if needed.")
