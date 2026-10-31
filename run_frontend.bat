@echo off
cd /d "%~dp0frontend"
echo Starting CloudVault React + Vite Frontend on http://localhost:5173 ...
set PATH=C:\Program Files\nodejs;%PATH%
npm.cmd run dev
