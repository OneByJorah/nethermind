@echo off
echo ============================================
echo  Nethermind Desktop - Starting Application
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Installing Electron dependencies if needed...
if not exist "node_modules" (
    call npm install
)

echo.
echo [2/3] Starting Nethermind Desktop...
echo.
echo Backend will start on http://localhost:8000
echo Frontend will start on http://localhost:3000
echo.

call npx electron .

echo.
echo [3/3] Application closed.
pause
