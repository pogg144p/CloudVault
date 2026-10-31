@echo off
cd /d "%~dp0backend"
echo Starting CloudVault FastAPI Backend on http://127.0.0.1:8000 ...
.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
