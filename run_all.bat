@echo off
echo Starting CloudVault Backend and Frontend in separate windows...
start "CloudVault Backend (FastAPI)" cmd /k "cd /d "%~dp0" && run_backend.bat"
start "CloudVault Frontend (Vite React)" cmd /k "cd /d "%~dp0" && run_frontend.bat"
echo Done! Both services are launching.
echo Backend:  http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/api/v1/docs)
echo Frontend: http://localhost:5173
