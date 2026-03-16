# Client Service - CRUD operations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.postgres.client import Client, ClientContact
from app.utils.generators import generate_client_code


async def list_clients(db: AsyncSession, page: int = 1, limit: int = 20, search: str = None, status: str = None):
    query = select(Client).where(Client.is_deleted == False)
    count_query = select(func.count(Client.id)).where(Client.is_deleted == False)

    if search:
        sf = or_(
            Client.name.ilike(f"%{search}%"),
            Client.code.ilike(f"%{search}%"),
            Client.gstin.ilike(f"%{search}%"),
            Client.city.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    if status:
        query = query.where(Client.is_active == (status == "active"))
        count_query = count_query.where(Client.is_active == (status == "active"))

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit).order_by(Client.id.desc()))
    return result.scalars().all(), total


async def get_client(db: AsyncSession, client_id: int):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.is_deleted == False)
    )
    return result.scalar_one_or_none()


async def create_client(db: AsyncSession, data: dict) -> Client:
    if "code" not in data or not data["code"]:
        data["code"] = generate_client_code(data.get("name", "CLI"))
    client = Client(**data)
    db.add(client)
    await db.flush()
    return client


async def update_client(db: AsyncSession, client_id: int, data: dict):
    client = await get_client(db, client_id)
    if not client:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(client, k, v)
    return client


async def delete_client(db: AsyncSession, client_id: int) -> bool:
    client = await get_client(db, client_id)
    if not client:
        return False
    client.is_deleted = True
    return True


# --- Client Contacts ---
async def list_client_contacts(db: AsyncSession, client_id: int):
    result = await db.execute(
        select(ClientContact).where(ClientContact.client_id == client_id)
    )
    return result.scalars().all()


async def create_client_contact(db: AsyncSession, client_id: int, data: dict) -> ClientContact:
    contact = ClientContact(client_id=client_id, **data)
    db.add(contact)
    await db.flush()
    return contact


async def delete_client_contact(db: AsyncSession, contact_id: int) -> bool:
    result = await db.execute(select(ClientContact).where(ClientContact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        return False
    await db.delete(contact)
    return True
