#!/bin/bash

# Time Tracker Shutdown Script
# This script gracefully stops the Time Tracker system

echo "🛑 Stopping Time Tracker..."

# Function to stop process by PID
stop_by_pid() {
    local pid=$1
    if ps -p $pid > /dev/null 2>&1; then
        echo "🔄 Stopping server process (PID: $pid)..."
        kill $pid
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! ps -p $pid > /dev/null 2>&1; then
                echo "✅ Server stopped gracefully"
                return 0
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            echo "⚠️  Force stopping server..."
            kill -9 $pid
            sleep 1
            if ! ps -p $pid > /dev/null 2>&1; then
                echo "✅ Server force stopped"
            else
                echo "❌ Failed to stop server"
                return 1
            fi
        fi
    else
        echo "ℹ️  Process $pid is not running"
    fi
    return 0
}

# Stop by saved PID file
if [ -f ".server.pid" ]; then
    SERVER_PID=$(cat .server.pid)
    stop_by_pid $SERVER_PID
    rm -f .server.pid
else
    echo "ℹ️  No PID file found"
fi

# Also kill any processes matching our pattern (backup method)
echo "🔍 Checking for any remaining Time Tracker processes..."
PIDS=$(pgrep -f "node src/index.js" 2>/dev/null || true)
if [ ! -z "$PIDS" ]; then
    echo "🔄 Found additional processes, stopping them..."
    for pid in $PIDS; do
        stop_by_pid $pid
    done
fi

# Kill any process using port 3000 (final cleanup)
PORT_PID=$(lsof -t -i:3000 2>/dev/null || true)
if [ ! -z "$PORT_PID" ]; then
    echo "🔄 Stopping process using port 3000 (PID: $PORT_PID)..."
    kill $PORT_PID 2>/dev/null || true
    sleep 1
fi

# Verify nothing is running on port 3000
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  Warning: Something is still running on port 3000"
    echo "   You may need to check manually with: lsof -i :3000"
else
    echo "✅ Port 3000 is now free"
fi

echo ""
echo "🎯 Time Tracker shutdown complete!"
echo "📊 Server logs are saved in: logs/server.log"
echo "🚀 To start again, run: ./start.sh"
echo ""