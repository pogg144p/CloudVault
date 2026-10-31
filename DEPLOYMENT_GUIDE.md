# CloudVault — Production Deployment Guide (Render + AWS S3 Free Tier)

> **Cost Target:** **Strictly $0.00** — Using Render Free Tier (Web Service + Managed PostgreSQL + Static Site) and AWS S3 Free Tier.
> **Philosophy:** No CLI/PowerShell AWS credential leaks. All AWS infrastructure is set up visually in the **AWS Web Console** in 5 minutes.

---

## Architecture in Production

```
┌────────────────────────────────────────────────────────┐
│     Render Static Site (Frontend React + Vite)         │
│     URL: https://cloudvault-app.onrender.com           │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼────────────────────────────┐
│     Render Web Service (FastAPI + Python 3.12)         │
│     URL: https://cloudvault-api.onrender.com           │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼─────────────┐ ┌──────────▼──────────────┐
│  Render PostgreSQL DB      │ │  AWS S3 Bucket (Free)   │
│  Managed free database     │ │  Encrypted object store │
└────────────────────────────┘ └─────────────────────────┘
```

---

## Step 1: Push Code to GitHub

1. Open **GitHub Desktop** on your computer.
2. Click **File** → **Add Local Repository**.
3. Choose path: `C:\Users\AAKASHDEEP\Desktop\Folders\pogg144p\Study\code\Projects\CloudVault`.
4. If it asks you to initialize Git, click **Create Repository**.
5. Click **Publish repository** to push it to your personal GitHub account (can be public or private).

---

## Step 2: Set Up AWS S3 in AWS Web Console (Strictly Free Tier)

### 2.1 Create S3 Bucket
1. Log into your [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **S3** and select it.
3. Click **Create bucket**.
4. Configure:
   - **Bucket name:** e.g., `cloudvault-storage-YOURNAME` (must be globally unique).
   - **AWS Region:** `US East (N. Virginia) us-east-1` (or your preferred region).
   - **Block Public Access settings for this bucket:** Keep **Block *all* public access** checked (secure by default; all downloads go through signed backend streams).
   - **Bucket Versioning:** Optional (can keep disabled).
   - **Default encryption:** Server-side encryption with Amazon S3 managed keys (SSE-S3) (free).
5. Click **Create bucket**.

### 2.2 Create an IAM User for CloudVault (Least Privilege)
1. In the top search bar, type **IAM** and select it.
2. In the left navigation, click **Users** → **Create user**.
3. **User name:** `cloudvault-app-user` → Click **Next**.
4. In Permissions options, choose **Attach policies directly**.
5. Search for `AmazonS3FullAccess` (or create an inline policy restricted to your bucket name) → Check it → Click **Next** → Click **Create user**.
6. Click on the newly created user `cloudvault-app-user`.
7. Go to the **Security credentials** tab.
8. Scroll down to **Access keys** → Click **Create access key**.
9. Select **Application running outside AWS** → Click **Next** → Click **Create access key**.
10. **Copy two values** (or download the CSV):
    - `Access key ID` (e.g. `AKIAIOSFODNN7EXAMPLE`)
    - `Secret access key` (e.g. `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

---

## Step 3: Deploy on Render (1-Click with `render.yaml`)

1. Sign up or log into [Render.com](https://render.com/) with your GitHub account.
2. Click **New +** → **Blueprint**.
3. Connect your **CloudVault** GitHub repository.
4. Render will automatically read the [`render.yaml`](file:///c:/Users/AAKASHDEEP/Desktop/Folders/pogg144p/Study/code/Projects/CloudVault/render.yaml) file we created and propose 3 free services:
   - `cloudvault-backend` (Web Service)
   - `cloudvault-db` (PostgreSQL Database)
   - `cloudvault-frontend` (Static Site)
5. Under Environment Variables for `cloudvault-backend`, fill in your AWS credentials from Step 2:
   - `S3_BUCKET_NAME`: `cloudvault-storage-YOURNAME`
   - `S3_ACCESS_KEY`: `AKIA...`
   - `S3_SECRET_KEY`: `wJal...`
6. Click **Apply**.
7. Render will automatically:
   - Provision PostgreSQL.
   - Build and launch the FastAPI backend with database migrations.
   - Build React + Vite and publish the static site.

---

## Step 4: Verification

- Visit your live frontend URL (e.g. `https://cloudvault-frontend.onrender.com`).
- Sign in with the demo account or register a new one.
- Upload images, PDFs, code files, create folders, share links, and test file versions.
- All files are securely saved in AWS S3 with zero server memory overhead!
