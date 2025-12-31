@echo off
title Music Grabber - GitHub Push Tool
color 0b

echo ========================================================
echo   Music Grabber - Send Code to GitHub
echo ========================================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed on this computer.
    echo Please install it from https://git-scm.com/
    pause
    exit /b
)

:: Set GitHub Username (NO SPACES, NO QUOTES)
set "username=HC1215"

:: Set remote URL
set "remote_url=https://github.com/%username%/music-grab.git"

echo.
echo [Step 1] Setting up remote connection...
:: Remove if exists to avoid error
git remote remove origin >nul 2>&1
git remote add origin %remote_url%

echo [Step 2] Building App locally to ensure no cloud errors...
cd frontend
cmd /c npm run build
cd ..

echo [Step 3] Staging and Committing everything (including build)...
git add .
git commit -m "Deployment fix: Pushing built assets"

echo [Step 4] Preparing branch...
git branch -M main

echo [Step 5] Pushing to GitHub...
echo (A popup might appear asking you to sign into GitHub)
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. 
    echo 1. Make sure you created the 'music-grab' repo on GitHub first.
    echo 2. Make sure you typed your username correctly.
    echo 3. Make sure you signed in when prompted.
) else (
    echo.
    echo [SUCCESS] Your code is now on GitHub!
    echo.
    echo NEXT STEP:
    echo Go to Render.com and connect this repository.
)

echo.
pause
