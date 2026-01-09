# 🎵 Music Grabber PWA - Deployment Guide

---
title: Music Grabber
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
app_port: 3000
---

## 🚀 Quick Start - Deploy in 2 Minutes

### **Option 1: One-Click Deploy (Recommended)**
```bash
QUICK_DEPLOY.bat
```
Choose your platform:
- **[1] Firebase** - Frontend only (instant)
- **[2] Hugging Face** - Full stack with backend (5 min build)
- **[3] Both** - Deploy to both platforms

---

## 📋 Prerequisites

### For Firebase Deployment:
1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Login to Firebase:
   ```bash
   firebase login
   ```

### For Hugging Face Deployment:
1. Create a Hugging Face account at https://huggingface.co
2. Create a new Space:
   - Go to https://huggingface.co/new-space
   - Name: `music-grabber-premium` (or your choice)
   - SDK: Docker
   - Visibility: Public (or Private)
3. Get your access token:
   - Go to https://huggingface.co/settings/tokens
   - Create a new token with **WRITE** permission
   - Copy the token (you'll need it for deployment)

---

## 🎯 Deployment Options

### **Firebase Hosting (Frontend Only)**

**Pros:**
- ✅ Instant deployment (< 1 minute)
- ✅ Free tier: 10GB storage, 360MB/day bandwidth
- ✅ Global CDN
- ✅ Automatic SSL
- ✅ Perfect for PWA features

**Cons:**
- ⚠️ Backend requires Firebase Functions (pay-as-you-go)
- ⚠️ No yt-dlp/ffmpeg support on free tier

**Deploy:**
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

**Live URL:** https://music-grab.web.app/

---

### **Hugging Face Spaces (Full Stack)**

**Pros:**
- ✅ Completely FREE (no credit card required)
- ✅ Full backend support (Node.js + yt-dlp + ffmpeg)
- ✅ Docker-based deployment
- ✅ Automatic builds from Git
- ✅ 16GB RAM, 8 CPU cores (free tier)

**Cons:**
- ⚠️ Cold starts (~30 seconds if inactive)
- ⚠️ Build time: 2-3 minutes

**Deploy:**
```bash
# Build frontend
cd frontend
npm run build
cd ..

# Commit changes
git add .
git commit -m "Deploy to Hugging Face"

# Push to Hugging Face
git remote add huggingface https://huggingface.co/spaces/hc1215/music-grabber-premium
git push huggingface main --force
```

**Live URL:** https://huggingface.co/spaces/hc1215/music-grabber-premium

---

## 🛠️ Manual Deployment Steps

### Firebase (Detailed)

1. **Build the frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. **Initialize Firebase (first time only):**
   ```bash
   firebase init hosting
   ```
   - Select your project: `music-grab`
   - Public directory: `frontend/dist`
   - Single-page app: Yes
   - Set up automatic builds: No

3. **Deploy:**
   ```bash
   firebase deploy --only hosting
   ```

4. **View your app:**
   ```
   https://music-grab.web.app/
   ```

---

### Hugging Face (Detailed)

1. **Build the frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Deploy: $(date)"
   ```

3. **Add Hugging Face remote:**
   ```bash
   git remote add huggingface https://hc1215:YOUR_HF_TOKEN@huggingface.co/spaces/hc1215/music-grabber-premium
   ```
   Replace `YOUR_HF_TOKEN` with your actual token.

4. **Push to Hugging Face:**
   ```bash
   git push huggingface main --force
   ```

5. **Monitor the build:**
   - Go to https://huggingface.co/spaces/hc1215/music-grabber-premium
   - Click on "Logs" to see the Docker build progress
   - Wait 2-3 minutes for the build to complete

6. **View your app:**
   ```
   https://hc1215-music-grabber-premium.hf.space
   ```

---

## 📦 Project Structure

```
music-grab/
├── frontend/              # React + Vite PWA
│   ├── src/              # Source code
│   ├── dist/             # Built files (generated)
│   ├── package.json      # Frontend dependencies
│   └── vite.config.ts    # Vite + PWA config
├── functions/            # Firebase Functions (optional)
├── index.js              # Backend server (Express + yt-dlp)
├── Dockerfile            # Hugging Face deployment
├── firebase.json         # Firebase configuration
├── package.json          # Backend dependencies
├── QUICK_DEPLOY.bat      # One-click deployment script
└── README.md             # This file
```

---

## 🔧 Troubleshooting

### Firebase Issues

**Error: "Firebase command not found"**
```bash
npm install -g firebase-tools
```

**Error: "Not authorized"**
```bash
firebase login
firebase use music-grab
```

**Error: "Build failed"**
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

---

### Hugging Face Issues

**Error: "Push failed - authentication failed"**
- Check your token has WRITE permission
- Regenerate token at https://huggingface.co/settings/tokens
- Make sure you're using the correct Space name

**Error: "Docker build failed"**
- Check the build logs in the Hugging Face Space
- Common issues:
  - Missing dependencies in `package.json`
  - Frontend build errors
  - Dockerfile syntax errors

**Error: "Application error" after deployment**
- Check the Space logs for runtime errors
- Verify `PORT=3000` is set correctly
- Ensure `index.js` is serving the frontend from `frontend/dist`

---

## 🎨 PWA Features

This app is a Progressive Web App with:
- ✅ **Offline Support** - Works without internet (cached songs)
- ✅ **Install to Home Screen** - Acts like a native app
- ✅ **Background Sync** - Downloads continue in background
- ✅ **Push Notifications** - Get notified when downloads complete
- ✅ **Responsive Design** - Works on mobile, tablet, desktop

---

## 🔐 Environment Variables

### For Hugging Face:
No environment variables needed! Everything is configured in the Dockerfile.

### For Firebase Functions (if using):
Create `.env` file:
```env
NODE_ENV=production
```

---

## 📊 Performance

### Firebase Hosting:
- **Load Time:** < 1 second (global CDN)
- **Lighthouse Score:** 95+ (PWA)
- **Bandwidth:** Unlimited (within free tier limits)

### Hugging Face:
- **Cold Start:** ~30 seconds (if inactive)
- **Warm Response:** < 2 seconds
- **Download Speed:** Depends on yt-dlp and YouTube

---

## 🚀 Next Steps

1. **Deploy your app** using `QUICK_DEPLOY.bat`
2. **Test the PWA** on your mobile device
3. **Share the link** with friends!

---

## 📞 Support

- **GitHub Issues:** https://github.com/HC1215/music-grab/issues
- **Hugging Face Space:** https://huggingface.co/spaces/hc1215/music-grabber-premium/discussions

---

## 📄 License

MIT License - Feel free to use and modify!

---

**Made with ❤️ by HC1215**
