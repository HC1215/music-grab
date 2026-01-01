# --- STAGE 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- STAGE 2: Final Image ---
FROM node:20-slim

# Install system dependencies (Python for yt-dlp, FFmpeg for audio)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

# Copy root package files
COPY package.json ./
RUN npm install --production

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend files (index.js is in root)
COPY index.js ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Metadata
EXPOSE 3000

# Start the combined app
CMD ["node", "index.js"]
