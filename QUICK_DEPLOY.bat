@echo off
title Quick Deploy - Music Grabber PWA
color 0b

echo ========================================================
echo   MUSIC GRABBER PWA - QUICK DEPLOYMENT
echo ========================================================
echo.
echo Choose your deployment target:
echo.
echo   [1] Firebase (Frontend Only - Instant)
echo   [2] Hugging Face (Full Stack - 5 min build)
echo   [3] Both (Recommended)
echo   [0] Exit
echo.
set /p choice="Enter your choice (0-3): "

if "%choice%"=="0" exit /b
if "%choice%"=="1" goto firebase
if "%choice%"=="2" goto huggingface
if "%choice%"=="3" goto both

echo Invalid choice!
pause
exit /b

:firebase
echo.
echo ========================================================
echo   DEPLOYING TO FIREBASE
echo ========================================================
echo.
echo [1/3] Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b
)
cd ..

echo.
echo [2/3] Deploying to Firebase...
call firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo [ERROR] Firebase deployment failed!
    echo.
    echo Make sure you're logged in: firebase login
    pause
    exit /b
)

echo.
echo [3/3] Done!
echo.
echo ========================================================
echo   SUCCESS! Your PWA is live at:
echo   https://music-grab.web.app/
echo ========================================================
pause
exit /b

:huggingface
echo.
echo ========================================================
echo   DEPLOYING TO HUGGING FACE
echo ========================================================
echo.
echo [1/4] Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b
)
cd ..

echo.
echo [2/4] Committing changes...
git add .
git commit -m "Deploy: %date% %time%"

echo.
echo [3/4] Pushing to Hugging Face...
set /p HF_TOKEN="Paste your Hugging Face ACCESS TOKEN: "
if "%HF_TOKEN%"=="" (
    echo [ERROR] No token provided!
    pause
    exit /b
)

git remote remove huggingface 2>nul
git remote add huggingface https://hc1215:%HF_TOKEN%@huggingface.co/spaces/hc1215/music-grabber-premium
git push huggingface main --force

if %errorlevel% neq 0 (
    echo [ERROR] Push failed! Check your token permissions.
    pause
    exit /b
)

git remote remove huggingface

echo.
echo [4/4] Done!
echo.
echo ========================================================
echo   SUCCESS! Your app is building at:
echo   https://huggingface.co/spaces/hc1215/music-grabber-premium
echo   
echo   Wait 2-3 minutes for the Docker build to complete.
echo ========================================================
pause
exit /b

:both
echo.
echo ========================================================
echo   DEPLOYING TO BOTH PLATFORMS
echo ========================================================
echo.

:: Build once
echo [1/5] Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b
)
cd ..

:: Deploy to Firebase
echo.
echo [2/5] Deploying to Firebase...
call firebase deploy --only hosting

:: Commit for HF
echo.
echo [3/5] Committing changes...
git add .
git commit -m "Deploy: %date% %time%"

:: Deploy to Hugging Face
echo.
echo [4/5] Pushing to Hugging Face...
set /p HF_TOKEN="Paste your Hugging Face ACCESS TOKEN: "
if "%HF_TOKEN%"=="" (
    echo [ERROR] No token provided!
    pause
    exit /b
)

git remote remove huggingface 2>nul
git remote add huggingface https://hc1215:%HF_TOKEN%@huggingface.co/spaces/hc1215/music-grabber-premium
git push huggingface main --force
git remote remove huggingface

echo.
echo [5/5] Done!
echo.
echo ========================================================
echo   SUCCESS! Your PWA is live on BOTH platforms:
echo   
echo   Firebase:      https://music-grab.web.app/
echo   Hugging Face:  https://huggingface.co/spaces/hc1215/music-grabber-premium
echo ========================================================
pause
