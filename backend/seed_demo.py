import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.folder import Folder
from app.core.config import settings

async def seed_demo_user():
    await init_db()
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.email == "shakir260@gmail.com")
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            print("Creating demo user: AR Shakir (shakir260@gmail.com)...")
            user = User(
                email="shakir260@gmail.com",
                full_name="AR Shakir",
                hashed_password=get_password_hash("SecurePassword123!"),
                storage_quota_bytes=settings.DEFAULT_STORAGE_QUOTA_BYTES,
                storage_used_bytes=0,
            )
            db.add(user)
            await db.flush()

            default_folders = [
                {"name": "Design", "color": "#6366F1"},
                {"name": "Documents", "color": "#10B981"},
                {"name": "Music", "color": "#F59E0B"},
                {"name": "Images", "color": "#EF4444"},
            ]
            for fd in default_folders:
                folder = Folder(
                    user_id=user.id,
                    parent_id=None,
                    name=fd["name"],
                    path=f"/{fd['name']}/",
                    color=fd["color"],
                )
                db.add(folder)
            await db.commit()
            print("Successfully created demo user and default folders!")
        else:
            print("Demo user already exists.")

if __name__ == "__main__":
    asyncio.run(seed_demo_user())
