import asyncio
from app.db.postgres.connection import async_engine as engine
from sqlalchemy import text

async def check():
    async with engine.connect() as c:
        r = await c.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"))
        cols = [row[0] for row in r.fetchall()]
        print("DB columns:", cols)
        
        needed = ['employee_id', 'date_of_birth', 'gender', 'address', 'joining_date',
                  'emergency_contact_name', 'emergency_contact_phone',
                  'bank_account_holder', 'bank_name', 'account_number', 'ifsc_code',
                  'account_type', 'upi_id', 'salary_amount', 'pay_type',
                  'aadhaar_file_url', 'aadhaar_file_name',
                  'dl_file_url', 'dl_file_name', 'dl_number', 'dl_issue_date', 'dl_expiry_date']
        missing = [c for c in needed if c not in cols]
        if missing:
            print("MISSING columns:", missing)
        else:
            print("All needed columns exist")

asyncio.run(check())
