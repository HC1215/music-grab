@echo off
title FINAL FIX DEPLOYER
color 4f
echo ========================================================
echo   MUSIC GRABBER - EMERGENCY REPAIR
echo ========================================================

:: 1. Force Build
echo [1/3] Rebuilding your app properly...
cd frontend
cmd /c npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Try running 'npm install' in frontend folder first.
    pause
    exit
)
cd ..

:: 2. Fix Firebase Config
echo [2/3] Verifying Firebase settings...
:: (I already fixed firebase.json via tool, but let's ensure the project is set)
cmd /c firebase use --add music-grab --alias default

:: 3. Deploy everything
echo [3/3] Uploading to Google Cloud (Firebase)...
cmd /c firebase deploy --only hosting

echo.
echo ========================================================
echo  DONE. Visit: https://music-grab.web.app
echo.
echo  IF THE PAGE IS STILL BLANK:
echo  1. Open your browser and press CTRL+F5 to clear cache.
echo  2. Make sure you are logged in by typing 'firebase login'
echo ========================================================
pause
