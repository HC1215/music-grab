const { onRequest } = require("firebase-functions/v2/https");
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytSearch = require('yt-search');
const ytDlp = require('yt-dlp-exec');
const ffmpegStatic = require('ffmpeg-static');

// Configuration
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// For serverless, we use /tmp for all file operations
const TEMP_DIR = '/tmp/downloads';
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 1. Health Check
app.get('/health', (req, res) => res.send('Cloud Backend Online'));

// 2. Search Endpoint (Works great in serverless)
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

        const r = await ytSearch(q);
        const videos = r.videos.slice(0, 15).map(v => ({
            id: v.videoId,
            url: v.url,
            title: v.title,
            timestamp: v.timestamp,
            seconds: v.seconds,
            thumbnail: v.thumbnail,
            author: v.author.name
        }));
        res.json(videos);
    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Search failed' });
    }
});

// 3. Download Logic
// In serverless, we'll combine start/status/result into one request or use a polling simulator
// Because functions are stateless and might die between requests.
// However, /tmp is sometimes preserved between "warm" invocations.

const activeDownloads = new Map();

app.post('/api/download/start', (req, res) => {
    const { videoId, title } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId is required' });

    const jobId = Math.random().toString(36).substring(7);
    const safeTitle = (title || videoId).replace(/[<>:"/\\|?*]+/g, '_').trim();

    activeDownloads.set(jobId, {
        status: 'preparing',
        progress: 0,
        videoId,
        title: safeTitle,
        startTime: Date.now()
    });

    res.json({ jobId });

    // Background download in serverless is tricky. 
    // Usually, the function might terminate after sending response.
    // We'll rely on the 2nd Gen Function staying alive long enough if not busy.
    // A better way is to do it in the same request, but existing UI expects polling.
    processDownload(jobId, videoId, safeTitle).catch(console.error);
});

app.get('/api/download/status/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, progress: job.progress, error: job.error });
});

app.get('/api/download/result/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job not ready' });

    res.json(job.result);
});

async function processDownload(jobId, videoId, safeTitle) {
    const job = activeDownloads.get(jobId);
    if (!job) return;

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const cleanTitle = safeTitle.replace(/[^\w\s\-\u4e00-\u9fa5]/g, '').trim().substring(0, 30);
    const safeFilename = `${cleanTitle}_[${videoId}]`;
    const outputPath = path.join(TEMP_DIR, `${safeFilename}.mp3`);

    try {
        job.status = 'downloading';
        job.progress = 10;

        // Using yt-dlp-exec
        await ytDlp(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            ffmpegLocation: ffmpegStatic,
            output: outputPath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addMetadata: true
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error("File not found after download");
        }

        const stats = fs.statSync(outputPath);
        const audioBuffer = fs.readFileSync(outputPath);

        job.status = 'completed';
        job.progress = 100;
        job.result = {
            audioBase64: audioBuffer.toString('base64'),
            lyrics: '', // Lyrics extraction is complex in serverless, skipping for now
            metadata: {
                size: stats.size,
                downloadDate: Date.now()
            }
        };

        // Cleanup
        fs.unlinkSync(outputPath);
    } catch (err) {
        console.error('Download error:', err);
        job.status = 'error';
        job.error = err.message || 'Download failed';
    }
}

// Export the cloud function
exports.api = onRequest({
    memory: "1GiB",
    timeoutSeconds: 300,
    region: "us-central1",
    cors: true
}, app);
