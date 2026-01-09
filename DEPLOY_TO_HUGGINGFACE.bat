@echo off
title Push to Hugging Face Space
color 0e

echo ========================================================
echo   Deploying to Hugging Face Space
echo ========================================================
echo.

:: Get the token from user
set /p HF_TOKEN="Paste your Hugging Face ACCESS TOKEN here: "

if "%HF_TOKEN%"=="" (
    echo [ERROR] No token provided!
    pause
    exit /b
)

:: 1. Add Hugging Face as a remote with token in URL
echo.
echo [1/2] Setting up Hugging Face remote...
git remote remove huggingface 2>nul
git remote add huggingface https://hc1215:%HF_TOKEN%@huggingface.co/spaces/hc1215/music-grabber-premium

:: 2. Push to Hugging Face
echo.
echo [2/2] Pushing code to Hugging Face...
git push huggingface main --force

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed!
    echo.
    echo Common issues:
    echo 1. Token doesn't have WRITE permission
    echo 2. You're not the owner of the Space
    echo 3. Token has expired
    echo.
    echo Please verify at: https://huggingface.co/settings/tokens
    pause
    exit /b
)

:: Clean up (remove token from git config for security)
git remote remove huggingface

echo.
echo ========================================================
echo   SUCCESS! Code deployed to Hugging Face.
echo   
echo   Your app is building at:
echo   https://huggingface.co/spaces/hc1215/music-grabber-premium
echo   
echo   Wait 2-3 minutes for the build to complete.
echo ========================================================
pause
