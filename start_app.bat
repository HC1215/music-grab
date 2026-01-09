@echo off
echo Starting Music Grabber...

start "Backend Server" cmd /k "cd backend && node index.js"
start "Frontend App" cmd /k "cd frontend && npm run dev"

echo Application started!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3001
