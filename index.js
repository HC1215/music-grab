const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytSearch = require('yt-search');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

// Configuration
const app = express();
const PORT = process.env.PORT || 3000;
// Use /tmp for downloads in cloud environments
const DOWNLOAD_DIR = process.env.NODE_ENV === 'production' ? '/tmp/downloads' : path.join(__dirname, 'downloads');
const UI_DIST = path.join(__dirname, 'frontend/dist');
const ffmpegPath = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg';

// Middleware
app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// 1. Serve Downloaded Music
app.use('/downloads', express.static(DOWNLOAD_DIR));

// 2. Health Check
app.get('/health', (req, res) => res.send('Backend Online'));

// 3. Search Endpoint
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

// 4. Download Job Store
const activeDownloads = new Map();

// Download Start
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
    processDownload(jobId, videoId, safeTitle);
});

// Download Status
app.get('/api/download/status/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, progress: job.progress, error: job.error });
});

// Download Result
app.get('/api/download/result/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job not ready' });

    res.json(job.result);
    setTimeout(() => activeDownloads.delete(req.params.id), 30000);
});

// List Downloads
app.get('/api/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const audioFiles = files
            .filter(f => /\.(mp3|m4a|wav)$/i.test(f))
            .map(f => {
                const stats = fs.statSync(path.join(DOWNLOAD_DIR, f));
                const baseName = path.parse(f).name;
                const vttName = files.find(v => v.startsWith(baseName) && v.endsWith('.vtt'));
                return {
                    filename: f,
                    size: stats.size,
                    mtime: stats.mtimeMs,
                    lyricFile: vttName || null
                };
            });
        res.json(audioFiles);
    } catch (e) {
        res.status(500).json({ error: 'Failed to list' });
    }
});

// 5. Download Logic (yt-dlp)
async function processDownload(jobId, videoId, safeTitle) {
    const job = activeDownloads.get(jobId);
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const cleanTitle = safeTitle.replace(/[^\w\s\-\u4e00-\u9fa5]/g, '').trim().substring(0, 30);
    const safeFilename = `${cleanTitle}_[${videoId}]`;
    const baseFileName = path.join(DOWNLOAD_DIR, safeFilename);

    const args = [
        '--no-colors', '--newline', '--ignore-errors',
        '-x', '--audio-format', 'mp3',
        '--ffmpeg-location', ffmpegPath,
        '--write-sub', '--write-auto-sub',
        '--sub-langs', 'zh-Hans,zh-Hant,zh,en',
        '--sub-format', 'vtt',
        '-o', `${baseFileName}.%(ext)s`,
        url
    ];

    const child = spawn('python', ['-m', 'yt_dlp', ...args]);

    child.stdout.on('data', (data) => {
        const match = data.toString().match(/\[download\]\s+(\d+(\.\d+)?)%/);
        if (match && activeDownloads.has(jobId)) {
            const j = activeDownloads.get(jobId);
            const percent = parseFloat(match[1]);
            if (percent > j.progress) {
                j.status = 'downloading';
                j.progress = percent;
            }
        }
    });

    child.on('close', async (code) => {
        if (!activeDownloads.has(jobId)) return;
        const finalAudioPath = `${baseFileName}.mp3`;

        if (!fs.existsSync(finalAudioPath)) {
            job.status = 'error';
            job.error = 'Download failed or file not found';
            return;
        }

        job.status = 'completed';
        job.progress = 100;

        try {
            const audioBuffer = fs.readFileSync(finalAudioPath);
            const stats = fs.statSync(finalAudioPath);
            let lyrics = '';
            const vttFile = fs.readdirSync(DOWNLOAD_DIR).find(f => f.includes(videoId) && f.endsWith('.vtt'));
            if (vttFile) lyrics = fs.readFileSync(path.join(DOWNLOAD_DIR, vttFile), 'utf-8');

            job.result = {
                audioBase64: audioBuffer.toString('base64'),
                lyrics,
                metadata: { size: stats.size, downloadDate: Date.now() }
            };

            // Cleanup server file after reading into memory
            try {
                fs.unlinkSync(finalAudioPath);
                const vttFile = fs.readdirSync(DOWNLOAD_DIR).find(f => f.includes(videoId) && f.endsWith('.vtt'));
                if (vttFile) fs.unlinkSync(path.join(DOWNLOAD_DIR, vttFile));
            } catch (e) { console.error("Cleanup error", e); }

        } catch (err) {
            job.status = 'error';
            job.error = 'Failed to process file';
        }
    });
}

// 6. Serve Frontend (SPA Fallback)
if (fs.existsSync(UI_DIST)) {
    app.use(express.static(UI_DIST));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/downloads')) return;
        res.sendFile(path.join(UI_DIST, 'index.html'));
    });
} else {
    app.get('*', (req, res) => {
        res.send('<h1>Setting up...</h1><p>Please build the frontend or wait a moment.</p>');
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Music App ready on port ${PORT}`);
});
