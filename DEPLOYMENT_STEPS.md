# CloudVault — Production Deployment (Render + Free S3 Storage)

Everything for **Week 8: Production Deployment** is ready in your codebase.

---

### Step 1: Push CloudVault to GitHub (Using GitHub Desktop)

Because Git is installed through GitHub Desktop on Windows:

1. Open **GitHub Desktop** on your computer (search for it in the Start menu).
2. Click **File** $\to$ **Add Local Repository** (or press `Ctrl + O`).
3. Set Local path to your CloudVault project folder:
   ```text
   C:\Users\AAKASHDEEP\Desktop\Folders\pogg144p\Study\code\Projects\CloudVault
   ```
4. If it shows *"This directory does not appear to be a Git repository"*, click **"create a repository"** link:
   - Name: `CloudVault`
   - Git Ignore: None (we already have a pre-configured [`.gitignore`](file:///c:/Users/AAKASHDEEP/Desktop/Folders/pogg144p/Study/code/Projects/CloudVault/.gitignore))
   - License: MIT
   - Click **Create repository**.
5. In the bottom-left of GitHub Desktop, type a commit summary: `Initial commit: Complete CloudVault platform`.
6. Click **Commit to main**.
7. Click the top button: **Publish repository** to push it to your GitHub account (leave *"Keep this code private"* unchecked if you want it visible on your profile).

---

### Step 2: Set Up Free Cloud Storage (Choose A or B)

#### Option A: Supabase Storage (Fastest — 1 Minute, Zero Card Required)
1. Go to [supabase.com](https://supabase.com) and log in with GitHub.
2. Click **New project** $\to$ name it `CloudVault`.
3. In the left menu, click **Storage** $\to$ **New bucket** $\to$ name it: `cloudvault-bucket`.
4. Go to **Project Settings** (gear icon) $\to$ **Storage** $\to$ **S3 Access Keys** $\to$ Click **New access key**.
5. Save the **Endpoint**, **Access Key ID**, and **Secret Access Key**.

#### Option B: AWS S3 Free Tier (Standard AWS)
1. In the [AWS Management Console](https://console.aws.amazon.com/), search **S3** $\to$ **Create bucket** (`cloudvault-storage-YOURNAME`).
2. In **IAM** $\to$ **Users** $\to$ Create user with S3 permissions $\to$ Generate Access Key & Secret.

---

### Step 3: 1-Click Deployment on Render.com (100% Free Tier)

1. Go to [Render.com](https://render.com) and log in with your GitHub account.
2. Click **New +** (top right) $\to$ Select **Blueprint**.
3. Select your **CloudVault** repository from GitHub.
4. Render will automatically detect the [`render.yaml`](file:///c:/Users/AAKASHDEEP/Desktop/Folders/pogg144p/Study/code/Projects/CloudVault/render.yaml) file we created and set up:
   * **`cloudvault-backend`** (Python 3.12 Web Service)
   * **`cloudvault-db`** (Managed PostgreSQL database)
   * **`cloudvault-frontend`** (Static Site CDN)
5. Fill in the storage environment variables under `cloudvault-backend`:
   * `S3_ENDPOINT_URL`: Your Supabase or AWS S3 endpoint
   * `S3_BUCKET_NAME`: `cloudvault-bucket`
   * `S3_ACCESS_KEY`: Your access key
   * `S3_SECRET_KEY`: Your secret key
6. Click **Apply**.

Render will build both the frontend and backend, configure PostgreSQL, run database migrations, and provide you with a live URL (e.g., `https://cloudvault-app.onrender.com`) to put on your resume!
