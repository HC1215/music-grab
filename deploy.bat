@echo off
title Music Grabber Deployer
color 0f

echo ========================================================
echo   Music Grabber - Auto Deployment to Firebase
echo ========================================================
echo.

:: 1. Build the Frontend
echo [Step 1] Building Frontend App (PWA)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Please check errors above.
    pause
    exit /b
)
cd ..
echo [SUCCESS] Build complete. Artifacts in frontend/dist
echo.

:: 2. Check for Firebase Login
echo [Step 2] Checking Firebase Authentication...
call firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] You are not logged in. Opening login window...
    call firebase login
) else (
    echo [SUCCESS] Already logged in.
)
echo.

:: 3. Check for Initialization
if not exist firebase.json (
    echo [Step 3] Initializing Project...
    echo.
    echo IMPORTANT INSTRUCTIONS:
    echo 1. Select 'Hosting' (Space to select, Enter to confirm)
    echo 2. Choose 'Create a new project' or 'Use existing'
    echo 3. Public directory? Type: frontend/dist
    echo 4. Configure as single-page app? Type: Y
    echo 5. Set up automatic builds? Type: N
    echo 6. Overwrite index.html? Type: N  (VERY IMPORTANT)
    echo.
    pause
    call firebase init hosting
)

:: 4. Deploy
echo.
echo [Step 4] Deploying to the Cloud...
call firebase deploy

echo.
echo ========================================================
echo   DONE! Your app is live.
echo   Open the 'Hosting URL' shown above on your phone.
echo ========================================================
pause
