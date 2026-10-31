import os
import shutil
import sqlite3
import datetime
import tempfile
import pytest

from app.core.config import settings

def test_backup_and_recovery_flow():
    """Validates full backup export and disaster recovery restoration."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backup_db_path = os.path.join(tmpdir, "backup_vault.db")
        backup_storage_path = os.path.join(tmpdir, "backup_storage")

        # 1. Simulate active database with records
        db_path = os.path.join(tmpdir, "active_vault.db")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("CREATE TABLE files (id TEXT PRIMARY KEY, name TEXT, size INTEGER)")
        cur.execute("INSERT INTO files VALUES ('f1', 'critical_document.pdf', 1048576)")
        conn.commit()
        conn.close()

        # 2. Simulate active storage
        storage_dir = os.path.join(tmpdir, "active_storage")
        os.makedirs(storage_dir, exist_ok=True)
        with open(os.path.join(storage_dir, "critical_document.pdf"), "w") as f:
            f.write("Critical customer agreement bytes")

        # 3. Perform snapshot backup
        shutil.copy2(db_path, backup_db_path)
        shutil.copytree(storage_dir, backup_storage_path)

        assert os.path.exists(backup_db_path)
        assert os.path.exists(os.path.join(backup_storage_path, "critical_document.pdf"))

        # 4. Simulate catastrophic data loss (active files deleted)
        os.remove(db_path)
        shutil.rmtree(storage_dir)
        assert not os.path.exists(db_path)
        assert not os.path.exists(storage_dir)

        # 5. Execute disaster recovery restore
        shutil.copy2(backup_db_path, db_path)
        shutil.copytree(backup_storage_path, storage_dir)

        # 6. Verify restored database and file integrity
        recovered_conn = sqlite3.connect(db_path)
        recovered_cur = recovered_conn.cursor()
        recovered_cur.execute("SELECT name, size FROM files WHERE id='f1'")
        row = recovered_cur.fetchone()
        assert row is not None
        assert row[0] == "critical_document.pdf"
        assert row[1] == 1048576
        recovered_conn.close()

        with open(os.path.join(storage_dir, "critical_document.pdf"), "r") as f:
            content = f.read()
        assert content == "Critical customer agreement bytes"
