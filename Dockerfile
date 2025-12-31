# Use Node.js 20 as the base image
FROM node:20-slim

# Install system dependencies: Python3, Pip, FFmpeg
# node:slim images are Debian-based
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# --- FRONTEND BUILD ---
# Copy frontend dependency files first for caching
COPY frontend/package*.json ./frontend/
# Install frontend dependencies
RUN cd frontend && npm install
# Copy the rest of the frontend code
COPY frontend ./frontend/
# Build the React app (outputs to frontend/dist)
RUN cd frontend && npm run build

# --- BACKEND SETUP ---
# Copy backend dependency files
COPY backend/package*.json ./backend/
# Install backend dependencies
RUN cd backend && npm install

# Install yt-dlp (Python dependency) globally
# --break-system-packages is needed on newer Debian/Python versions to allow global pip install
RUN pip3 install yt-dlp --break-system-packages

# Copy the rest of the backend code
COPY backend ./backend/

# Expose the port the app runs on
ENV PORT=3000
EXPOSE 3000

# Start the server
# Make sure we are in the correct directory relative to where index.js expects 'downloads'
WORKDIR /app/backend
CMD ["node", "index.js"]
