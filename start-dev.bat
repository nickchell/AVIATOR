@echo off
echo Starting Aviator Crash Game Development Environment...
echo.

echo [1/3] Starting Socket.IO Server (MUST START FIRST)...
start "Socket.IO Server" cmd /k "cd socket-server && npm run dev"

echo [2/3] Starting Backend Server (waits 5 seconds)...
timeout /t 5 /nobreak > nul
start "Backend Server" cmd /k "cd backend && npm start"

echo [3/3] Starting Frontend Development Server (waits 3 seconds)...
timeout /t 3 /nobreak > nul
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo All services are starting...
echo - Socket.IO Server: http://localhost:3001
echo - Backend API: http://localhost:3000
echo - Frontend: http://localhost:5173
echo.
echo Press any key to exit this script (services will continue running)
pause > nul 