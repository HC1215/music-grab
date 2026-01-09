#!/bin/bash

echo "=========================================="
echo "   Music Grabber - Termux Setup Script   "
echo "=========================================="

echo "[1/3] Installing System Dependencies..."
pkg update && pkg upgrade -y
pkg install -y nodejs python ffmpeg git

echo "[2/3] Installing yt-dlp..."
pip install yt-dlp

echo "[3/3] Setting up Backend..."
cd backend
npm install

echo ""
echo "=========================================="
echo " SETUP COMPLETE!"
echo " To start your mobile server, type:"
echo " cd backend && node index.js"
echo ""
echo " Then visit http://localhost:3000 in your"
echo " phone's browser."
echo "=========================================="
