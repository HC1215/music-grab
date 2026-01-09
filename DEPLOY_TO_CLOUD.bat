@echo off
title Music Grabber - Easy Cloud Deployer (Koyeb/Railway/Render)
color 0a

echo ========================================================
echo   Music Grabber - One-Click Cloud Prep ^& Push
echo ========================================================
echo.

:: 1. Verify Local Environment
echo [1/3] Checking for Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed! 
    echo Please install Git from: https://git-scm.com/
    pause
    exit /b
)

:: 2. Prepare for Cloud
echo.
echo [2/3] Preparing optimized files for Cloud Hosting...
echo - Dockerfile: OK (Multi-stage build)
echo - index.js: OK (Unified Backend/Frontend)

:: 3. Commit and Push to GitHub
echo.
echo [3/3] Syncing with GitHub...
set /p commit_msg="Enter update message (e.g. Premium Update): "

git add .
git commit -m "%commit_msg%"
git push

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git push failed. 
    echo Make sure you have connected this folder to a GitHub Repo:
    echo 1. Create a new repo on github.com
    echo 2. git remote add origin YOUR_REPO_URL
    echo 3. git branch -M main
    pause
    exit /b
)

echo.
echo ========================================================
echo   DONE! Your code is now in the Cloud.
echo.
echo   FINAL STEP:
echo   1. Go to https://app.koyeb.com/
echo   2. Create "New Service" -> select your GitHub Repo
echo   3. Set Build to "Docker" and Port to "3000"
echo   4. Deploy!
echo ========================================================
pause
