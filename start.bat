@echo off
REM Time Tracker Startup Script for Windows
REM This script starts the Time Tracker system and opens it in your default browser

echo 🚀 Starting Time Tracker...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Kill any existing process on port 3000
echo 🔍 Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    echo ⚠️  Found existing process on port 3000. Stopping it...
    taskkill /f /pid %%a >nul 2>nul
)

REM Start the server
echo 🔧 Starting Time Tracker server...
start /b npm start > logs\server.log 2>&1

REM Wait for server to start
echo ⏳ Waiting for server to start...
timeout /t 3 /nobreak >nul

REM Open browser
echo 🌍 Opening Time Tracker in your browser...
start http://localhost:3000

echo.
echo 🎉 Time Tracker is now running!
echo 📍 URL: http://localhost:3000
echo 📋 To stop the server, run: stop.bat
echo 📊 Check logs in: logs\server.log
echo.
echo Press any key to continue (server will keep running)...
pause >nul