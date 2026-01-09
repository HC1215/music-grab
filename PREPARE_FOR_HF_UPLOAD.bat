@echo off
title Prepare Files for Hugging Face Upload
color 0e

echo ========================================================
echo   Preparing Clean Files for Hugging Face
echo ========================================================
echo.

:: Create a clean export folder
echo [1/2] Creating clean export folder...
if exist hf-upload rmdir /s /q hf-upload
mkdir hf-upload

:: Copy only the necessary files (no binaries, no git history)
echo [2/2] Copying files...
xcopy /E /I /Y frontend hf-upload\frontend /EXCLUDE:exclude.txt
xcopy /E /I /Y functions hf-upload\functions
copy /Y Dockerfile hf-upload\
copy /Y index.js hf-upload\
copy /Y package.json hf-upload\
copy /Y README.md hf-upload\

:: Remove dist and downloads from the copy
if exist hf-upload\frontend\dist rmdir /s /q hf-upload\frontend\dist
if exist hf-upload\backend\downloads rmdir /s /q hf-upload\backend\downloads

echo.
echo ========================================================
echo   Files ready in the 'hf-upload' folder!
echo   
echo   NEXT STEPS:
echo   1. Go to: https://huggingface.co/spaces/hc1215/music-grabber-premium/tree/main
echo   2. Click "Add file" -> "Upload files"
echo   3. Drag ALL files from the 'hf-upload' folder
echo   4. Click "Commit changes to main"
echo   
echo   Your app will build automatically!
echo ========================================================
pause
