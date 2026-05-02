import asyncio, sys
sys.path.insert(0, '.')
from app.db.postgres.connection import AsyncSessionLocal
from sqlalchemy import text

async def fix():
    async with AsyncSessionLocal() as db:
        # Find LRs where pod_uploaded=True but status is not pod_received
        result = await db.execute(text(
            "SELECT id, lr_number, status::text, pod_uploaded, pod_file_url "
            "FROM lrs WHERE pod_uploaded = true AND LOWER(status::text) != 'pod_received' AND is_deleted = false"
        ))
        rows = result.all()
        print(f"Found {len(rows)} LRs with POD uploaded but wrong status:")
        for r in rows:
            print(f"  LR #{r.id} ({r.lr_number}): status={r.status}")

        if rows:
            ids = [r.id for r in rows]
            await db.execute(text(
                f"UPDATE lrs SET status = 'POD_RECEIVED' WHERE id = ANY(ARRAY{ids}::int[])"
            ))
            await db.commit()
            print(f"Updated {len(rows)} LR(s) to POD_RECEIVED status")
        else:
            print("No LRs needed fixing")

asyncio.run(fix())
