@echo off
title DemiCare

echo ========================================
echo          Starting DemiCare
echo ========================================
echo.

echo Starting Recognition API...
start "DemiCare - Recognition API" powershell -NoExit -Command "Set-Location 'C:\Users\user\Desktop\DemiCare'; .\recognition\.venv\Scripts\Activate.ps1; python -m uvicorn recognition.api:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Starting Frontend...
start "DemiCare - Frontend" powershell -NoExit -Command "Set-Location 'C:\Users\user\Desktop\DemiCare\frontend'; npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo DemiCare services started.
echo Frontend: http://localhost:5173
echo API:      http://127.0.0.1:8000
echo.
start http://localhost:5173
