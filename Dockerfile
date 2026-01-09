# --- STAGE 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- STAGE 2: Final Image ---
FROM node:20-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install yt-dlp --break-system-packages

# The node:slim image already has a 'node' user with UID 1000
USER node
ENV HOME=/home/node
ENV PATH=$HOME/.local/bin:$PATH

WORKDIR $HOME/app

# Copy root package files
COPY --chown=node package.json ./
RUN npm install --production

# Copy built frontend
COPY --chown=node --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend files
COPY --chown=node index.js ./

# Create downloads folder in /tmp and set permissions
# Note: /tmp is usually world-writable, but we ensure it works for our user
RUN mkdir -p /tmp/downloads && chmod 777 /tmp/downloads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
