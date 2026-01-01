@echo off
echo ========================================
echo Music Grab - Firebase Deployment
echo ========================================
echo.

REM Step 1: Build the frontend
echo [1/3] Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd ..
echo Frontend build complete!
echo.

REM Step 2: Check Firebase login status
echo [2/3] Checking Firebase authentication...
call npx -y firebase-tools login:list
if %errorlevel% neq 0 (
    echo.
    echo You need to login to Firebase first.
    echo Opening Firebase login...
    call npx -y firebase-tools login
    if %errorlevel% neq 0 (
        echo ERROR: Firebase login failed!
        pause
        exit /b 1
    )
)
echo.

REM Step 3: Deploy to Firebase
echo [3/3] Deploying to Firebase...
call npx -y firebase-tools deploy --only hosting
if %errorlevel% neq 0 (
    echo ERROR: Firebase deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo Your PWA is now live on Firebase!
echo.
pause
