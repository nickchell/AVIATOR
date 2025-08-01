#!/bin/bash

echo "Starting Aviator Crash Game Development Environment..."
echo

echo "[1/3] Starting Socket.IO Server (MUST START FIRST)..."
cd socket-server && npm run dev &
SOCKET_PID=$!

echo "[2/3] Starting Backend Server (waits 5 seconds)..."
sleep 5
cd ../backend && npm start &
BACKEND_PID=$!

echo "[3/3] Starting Frontend Development Server (waits 3 seconds)..."
sleep 3
cd .. && npm run dev &
FRONTEND_PID=$!

echo
echo "All services are starting..."
echo "- Socket.IO Server: https://aviator-socket-server.onrender.com"
echo "- Backend API: https://aviator-backend-vtww.onrender.com"
echo "- Frontend: http://localhost:5173"
echo
echo "Press Ctrl+C to stop all services"

# Function to cleanup processes on exit
cleanup() {
    echo
    echo "Stopping all services..."
    kill $SOCKET_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 