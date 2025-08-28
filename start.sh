#!/bin/bash

# Time Tracker Startup Script
# This script starts the Time Tracker system and opens it in your default browser

echo "🚀 Starting Time Tracker..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Kill any existing process on port 3000
echo "🔍 Checking for existing processes on port 3000..."
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Found existing process on port 3000. Attempting to stop it..."
    pkill -f "node src/index.js" 2>/dev/null || true
    sleep 2
fi

# Start the server in background
echo "🔧 Starting Time Tracker server..."
nohup npm start > logs/server.log 2>&1 &
SERVER_PID=$!

# Create logs directory if it doesn't exist
mkdir -p logs

# Save PID for shutdown script
echo $SERVER_PID > .server.pid

# Wait a moment for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully (PID: $SERVER_PID)"
    
    # Wait for server to be ready on port 3000
    echo "🌐 Waiting for server to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    
    # Open browser
    echo "🌍 Opening Time Tracker in your browser..."
    
    # Detect OS and open browser accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Check if we're in WSL (Windows Subsystem for Linux)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            # WSL detected - use Windows commands to open browser
            if command -v cmd.exe &> /dev/null; then
                cmd.exe /c start http://localhost:3000 2>/dev/null
            elif command -v wslview &> /dev/null; then
                wslview http://localhost:3000 2>/dev/null
            else
                echo "📝 WSL detected. Please open http://localhost:3000 in your Windows browser"
            fi
        else
            # Regular Linux
            if command -v xdg-open &> /dev/null; then
                xdg-open http://localhost:3000
            elif command -v gnome-open &> /dev/null; then
                gnome-open http://localhost:3000
            else
                echo "📝 Please open http://localhost:3000 in your browser"
            fi
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:3000
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start http://localhost:3000
    else
        echo "📝 Please open http://localhost:3000 in your browser"
    fi
    
    echo ""
    echo "🎉 Time Tracker is now running!"
    echo "📍 URL: http://localhost:3000"
    echo "📋 To stop the server, run: ./stop.sh"
    echo "📊 Check logs with: tail -f logs/server.log"
    echo ""
else
    echo "❌ Failed to start server"
    exit 1
fi