@echo off
title Clean Deploy to Hugging Face
color 0e

echo ========================================================
echo   Clean Deployment to Hugging Face Space
echo ========================================================
echo.
echo This will create a fresh Git history without binary files.
echo.

:: Get the token from user
set /p HF_TOKEN="Paste your Hugging Face ACCESS TOKEN: "

if "%HF_TOKEN%"=="" (
    echo [ERROR] No token provided!
    pause
    exit /b
)

:: 1. Create a fresh branch without history
echo.
echo [1/4] Creating clean branch...
git checkout --orphan clean-deploy

:: 2. Add only current files
echo.
echo [2/4] Adding current files...
git add -A

:: 3. Commit
echo.
echo [3/4] Creating fresh commit...
git commit -m "Clean deployment: Music Grabber PWA"

:: 4. Force push to Hugging Face
echo.
echo [4/4] Deploying to Hugging Face...
git remote remove huggingface 2>nul
git remote add huggingface https://hc1215:%HF_TOKEN%@huggingface.co/spaces/hc1215/music-grabber-premium
git push huggingface clean-deploy:main --force

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed!
    git checkout main
    git branch -D clean-deploy
    pause
    exit /b
)

:: 5. Cleanup
echo.
echo [5/5] Cleaning up...
git remote remove huggingface
git checkout main
git branch -D clean-deploy

echo.
echo ========================================================
echo   SUCCESS! Clean deployment complete.
echo   
echo   Your app is building at:
echo   https://huggingface.co/spaces/hc1215/music-grabber-premium
echo   
echo   Wait 2-3 minutes for the build to complete.
echo ========================================================
pause
