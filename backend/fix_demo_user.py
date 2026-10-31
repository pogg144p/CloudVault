import sqlite3
import uuid
import datetime
from app.core.security import get_password_hash, verify_password

db_path = r'c:\Users\AAKASHDEEP\Desktop\Folders\pogg144p\Study\code\Projects\CloudVault\backend\cloudvault.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Compute true Argon2 hash inside python
plain = 'SecurePassword123!'
hashed = get_password_hash(plain)

# Verify hash works
assert verify_password(plain, hashed) == True, "Verification failed!"

# Delete any corrupted user
cursor.execute("DELETE FROM users WHERE email = 'shakir260@gmail.com'")
cursor.execute("DELETE FROM folders WHERE path LIKE '/Design/%' OR path LIKE '/Documents/%' OR path LIKE '/Music/%' OR path LIKE '/Images/%'")

user_id = str(uuid.uuid4())
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
quota = 10 * 1024 * 1024 * 1024

cursor.execute('''
    INSERT INTO users (id, email, full_name, hashed_password, avatar_url, storage_quota_bytes, storage_used_bytes, is_active, is_superuser, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', (user_id, 'shakir260@gmail.com', 'AR Shakir', hashed, None, quota, 0, 1, 0, now, now))

folders = [
    ('Design', '#6366F1'),
    ('Documents', '#10B981'),
    ('Music', '#F59E0B'),
    ('Images', '#EF4444'),
]

for name, color in folders:
    f_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO folders (id, user_id, parent_id, name, path, color, is_favorite, is_deleted, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (f_id, user_id, None, name, f'/{name}/', color, 0, 0, None, now, now))

conn.commit()
print("SUCCESS: User AR Shakir seeded and password verified!")
conn.close()
