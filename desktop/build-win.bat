@echo off
echo ============================================
echo  Nethermind Desktop - Windows Build
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Installing Electron dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install desktop dependencies
    exit /b 1
)

echo.
echo [2/4] Building frontend for production...
cd ..\frontend
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    exit /b 1
)

echo.
echo [3/4] Building Windows installer (NSIS)...
cd ..\desktop
call npx electron-builder --win --x64
if %errorlevel% neq 0 (
    echo ERROR: Windows build failed
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
echo Output files are in: desktop\dist\
echo.
echo Available installers:
echo   - Nethermind-Setup-x64.exe  (NSIS Installer)
echo   - Nethermind-x64.exe        (Portable)
echo.
pause
