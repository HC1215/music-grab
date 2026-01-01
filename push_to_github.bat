@echo off
title Music Grabber - GitHub Push ^& Cloud Ready
color 0b

echo ========================================================
echo   Music Grabber - Auto-Sync to GitHub
echo ========================================================
echo.

:: 1. Git Check
echo [1/3] Checking Git status...
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Initializing Git repository...
    git init
    git remote add origin https://github.com/HC1215/music-grab.git
    git branch -M main
)

:: 2. Stage and Commit
echo.
echo [2/3] Preparing all premium updates...
echo - Optimized Dockerfile (Fast builds)
echo - Unified Search/Download Backend
echo - Mobile "Save to Device" feature
echo.

git add .
git commit -m "Full Cloud Optimization with Mobile Download Support"

:: 3. Push
echo.
echo [3/3] Pushing to https://github.com/HC1215/music-grab...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. 
    echo Please ensure you have permission to push to HC1215/music-grab.
    pause
    exit /b
)

echo.
echo ========================================================
echo   SUCCESS! Your project is now on GitHub.
echo.
echo   FINAL STEP:
echo   1. Go to https://app.koyeb.com/
echo   2. Link your GitHub and select 'HC1215/music-grab'
echo   3. Set build type to 'Docker' and port to '3000'
echo   4. Click Deploy!
echo.
echo   Your PWA will be live at the Koyeb URL.
echo ========================================================
pause
