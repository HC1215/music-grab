@echo off
title Music Grabber - Firebase Cloud Deploy
color 0b

echo ========================================================
echo   Music Grabber - FULL Cloud Deployment
echo ========================================================
echo.

:: 1. Building Frontend
echo [1/4] Building Premium Frontend...
cd frontend
cmd /c "npm install && npm run build"
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b
)
cd ..

:: 2. Preparing Functions
echo.
echo [2/4] Preparing Cloud Functions...
cd functions
cmd /c "npm install"
if %errorlevel% neq 0 (
    echo [ERROR] Functions setup failed!
    pause
    exit /b
)
cd ..

:: 3. Check for Firebase Login
echo.
echo [3/4] Checking Firebase connection...
call npx -y firebase-tools login:list
if %errorlevel% neq 0 (
    echo [INFO] Please login to Firebase...
    call npx -y firebase-tools login
)

:: 4. Deploy EVERYTHING
echo.
echo [4/4] Deploying to Firebase (Hosting + Functions)...
echo IMPORTANT: This requires the Firebase BLAZE (Pay-as-you-go) plan.
call npx -y firebase-tools deploy
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed!
    echo Most likely cause: You need to upgrade to the Firebase BLAZE plan.
    echo Visit: https://console.firebase.google.com/project/music-grab/usage/details
    echo.
    pause
    exit /b
)

echo.
echo ========================================================
echo   SUCCESS! Your PWA and Backend are now on the Cloud.
echo   URL: https://music-grab.web.app/
echo.
echo   The backend is now running automatically on Firebase!
echo   Go to Settings in the app and make sure 
echo   "Backend API URL" is EMPTY to use the cloud backend.
echo ========================================================
pause
