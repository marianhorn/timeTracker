@echo off
REM Time Tracker Shutdown Script for Windows
REM This script gracefully stops the Time Tracker system

echo 🛑 Stopping Time Tracker...

REM Kill Node.js processes running the Time Tracker
echo 🔄 Stopping Time Tracker server processes...
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    wmic process where "ProcessId=%%a and CommandLine like '%%src/index.js%%'" delete >nul 2>nul
)

REM Kill any process using port 3000
echo 🔍 Checking for processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    echo 🔄 Stopping process using port 3000 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>nul
)

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Verify port is free
netstat -aon | findstr ":3000" >nul 2>nul
if %errorlevel% equ 0 (
    echo ⚠️  Warning: Something might still be running on port 3000
    echo    You may need to check manually with: netstat -aon | findstr ":3000"
) else (
    echo ✅ Port 3000 is now free
)

echo.
echo 🎯 Time Tracker shutdown complete!
echo 📊 Server logs are saved in: logs\server.log
echo 🚀 To start again, run: start.bat
echo.
pause