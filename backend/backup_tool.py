import os
import shutil
import sqlite3
import datetime
import argparse

BACKUP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups"))
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "cloudvault.db"))
STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "storage_data"))


def create_backup():
    """Takes a consistent atomic snapshot of the SQLite database and local storage data."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    target_dir = os.path.join(BACKUP_DIR, f"backup_{timestamp}")
    os.makedirs(target_dir, exist_ok=True)

    print(f"[CloudVault Backup] Creating point-in-time snapshot in: {target_dir}")

    # 1. SQLite Online Backup API (Atomic and non-blocking)
    if os.path.exists(DB_PATH):
        dest_db = os.path.join(target_dir, "cloudvault.db")
        source_conn = sqlite3.connect(DB_PATH)
        dest_conn = sqlite3.connect(dest_db)
        with dest_conn:
            source_conn.backup(dest_conn, pages=100)
        dest_conn.close()
        source_conn.close()
        print(" -> Database snapshot completed successfully.")
    else:
        print(" -> Warning: cloudvault.db not found, skipping database.")

    # 2. Storage Data Copy
    if os.path.exists(STORAGE_DIR):
        dest_storage = os.path.join(target_dir, "storage_data")
        shutil.copytree(STORAGE_DIR, dest_storage, dirs_exist_ok=True)
        print(" -> Storage files snapshot completed successfully.")

    print(f"[CloudVault Backup] Backup created successfully: {target_dir}")
    return target_dir


def restore_backup(backup_folder: str):
    """Restores database and physical storage from a specified snapshot."""
    if not os.path.exists(backup_folder):
        print(f"[CloudVault Restore] Error: Backup directory not found: {backup_folder}")
        return False

    print(f"[CloudVault Restore] Restoring from: {backup_folder}")

    # Restore DB
    b_db = os.path.join(backup_folder, "cloudvault.db")
    if os.path.exists(b_db):
        shutil.copy2(b_db, DB_PATH)
        print(" -> Database restored.")

    # Restore Storage Data
    b_storage = os.path.join(backup_folder, "storage_data")
    if os.path.exists(b_storage):
        shutil.copytree(b_storage, STORAGE_DIR, dirs_exist_ok=True)
        print(" -> Storage data restored.")

    print("[CloudVault Restore] Restoration completed successfully!")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CloudVault Backup & Disaster Recovery CLI")
    parser.add_argument("--backup", action="store_true", help="Create a fresh backup snapshot")
    parser.add_argument("--restore", type=str, help="Restore from specific backup folder path")
    args = parser.parse_args()

    if args.restore:
        restore_backup(args.restore)
    else:
        create_backup()
