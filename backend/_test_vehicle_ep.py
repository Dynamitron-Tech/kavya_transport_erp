import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        login = await client.post("/auth/login", json={"email": "driver@kavyatransports.com", "password": "demo123"})
        token = login.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        r = await client.get("/drivers/me/vehicle", headers=headers)
        import json
        print(json.dumps(r.json(), indent=2))

asyncio.run(test())
