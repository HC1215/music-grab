const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegStatic = require('ffmpeg-static');
const ffmpegPath = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.send('Backend is Alive!'));

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// Serve downloads
app.use('/downloads', express.static(DOWNLOAD_DIR));

// Serve Frontend (Production)
let FRONTEND_DIST = path.join(__dirname, '../frontend/dist');
if (!fs.existsSync(FRONTEND_DIST)) {
    FRONTEND_DIST = path.join(process.cwd(), 'frontend/dist');
}
if (!fs.existsSync(FRONTEND_DIST)) {
    FRONTEND_DIST = path.join(process.cwd(), 'dist');
}

console.log('Checking for frontend at:', FRONTEND_DIST);
if (fs.existsSync(FRONTEND_DIST)) {
    console.log('Frontend found! Serving static files.');
    app.use(express.static(FRONTEND_DIST));
    // SPA Fallback: Any route not handled by API should return index.html
    app.get('/{*path}', (req, res, next) => {
        if (req.url.startsWith('/api/') || req.url.startsWith('/downloads/')) {
            return next();
        }
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
}

// Debug Path Endpoint
app.get('/api/debug-path', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        frontendDist: FRONTEND_DIST,
        frontendExists: fs.existsSync(FRONTEND_DIST),
        rootDirFiles: fs.readdirSync(path.join(__dirname, '..')),
        backendDirFiles: fs.readdirSync(__dirname)
    };
    res.json(info);
});

// List Downloads Endpoint
app.get('/api/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const audioFiles = files
            .filter(f => /\.(mp3|m4a|wav)$/i.test(f))
            .map(f => {
                const stats = fs.statSync(path.join(DOWNLOAD_DIR, f));
                const parsed = path.parse(f);
                const baseName = parsed.name; // "Song [ID]" or "Song"

                // Strict Lyric Finding
                // 1. Try exact match "Song [ID].vtt" or "Song.vtt"
                let vttName = files.find(v => v === baseName + '.vtt');

                // 2. If not found, try "Song.en.vtt" (common yt-dlp format)
                if (!vttName) {
                    vttName = files.find(v => v === baseName + '.en.vtt');
                }

                // 3. Fallback for old files: statsWith but ensure dot boundary to avoid "Song" matching "Song Remix"
                // e.g. "Song.vtt" matches "Song.mp3", but "Song Remix.vtt" should not.
                if (!vttName) {
                    vttName = files.find(v =>
                        (v.startsWith(baseName + '.') && v.endsWith('.vtt'))
                    );
                }

                return {
                    filename: f,
                    size: stats.size,
                    mtime: stats.mtimeMs,
                    lyricFile: vttName || null
                };
            });
        res.json(audioFiles);
    } catch (e) {
        res.status(500).json({ error: 'Failed to list directory' });
    }
});

// Search Endpoint
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

        const r = await ytSearch(query);
        const videos = r.videos.map(v => ({
            id: v.videoId,
            url: v.url,
            title: v.title,
            timestamp: v.timestamp,
            seconds: v.seconds,
            thumbnail: v.thumbnail,
            author: v.author.name
        }));
        res.json(videos);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Job Store
const activeDownloads = new Map();

const { spawn } = require('child_process');

// Download Start Endpoint
app.post('/api/download/start', (req, res) => {
    const { videoId, title } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId is required' });

    const jobId = Math.random().toString(36).substring(7);
    // Truncate title to 50 chars to prevent WS/Filesystem issues with long paths
    let cleanTitle = (title || videoId).replace(/[<>:"/\\|?*]+/g, '_').trim();
    if (cleanTitle.length > 50) cleanTitle = cleanTitle.substring(0, 50);

    const safeTitle = cleanTitle;

    activeDownloads.set(jobId, {
        status: 'preparing',
        progress: 0,
        videoId,
        title: safeTitle,
        startTime: Date.now()
    });

    res.json({ jobId });

    // Start background process
    processDownload(jobId, videoId, safeTitle);
});

// Download Status Endpoint
app.get('/api/download/status/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, progress: job.progress, error: job.error });
});

// Download Result Endpoint (Fetch Data)
app.get('/api/download/result/:id', (req, res) => {
    const job = activeDownloads.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job not ready' });

    res.json(job.result);

    // Cleanup after sending result
    setTimeout(() => {
        activeDownloads.delete(req.params.id);
    }, 10000);
});


async function processDownload(jobId, videoId, safeTitle) {
    const job = activeDownloads.get(jobId);
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // NEW STRATEGY: Include VideoID in filename to prevent collisions and ensure strict matching
    // Sanitize Title aggressively: Alphanumeric, Chinese, Spaces, Dashes. Drop special chars.
    let cleanTitle = (safeTitle || videoId).replace(/[^\w\s\-\u4e00-\u9fa5]/g, '').trim();
    // Collapse multiple spaces
    cleanTitle = cleanTitle.replace(/\s+/g, ' ');
    if (cleanTitle.length > 30) cleanTitle = cleanTitle.substring(0, 30); // Ultra short to be safe

    // Format: "Title_[VideoID]" (Use underscore separator for safety)
    const safeFilename = `${cleanTitle}_[${videoId}]`;
    const baseFileName = path.join(DOWNLOAD_DIR, safeFilename);
    const tempOutputTemplate = `${baseFileName}.%(ext)s`;

    console.log(`[${jobId}] Starting download: ${url}`);

    // Force Unbuffered Output for Progress
    const args = [
        '--no-colors',
        '--newline',
        '--ignore-errors', // Vital
        '-x', '--audio-format', 'mp3',
        '--ffmpeg-location', ffmpegPath,
        '--write-sub', '--write-auto-sub',
        '--sub-langs', 'zh-Hans,zh-Hant,zh,en', // Specific list again, strict but safe with ignore-errors
        '--sub-format', 'vtt',
        '--no-mtime',
        '-o', tempOutputTemplate,
        url
    ];

    const child = spawn('python', ['-m', 'yt_dlp', ...args]);

    child.stdout.on('data', (data) => {
        const str = data.toString();
        const lines = str.split(/[\r\n]+/);
        for (const line of lines) {
            const match = line.match(/\[download\]\s+(\d+(\.\d+)?)%/);
            if (match) {
                const percent = parseFloat(match[1]);
                if (activeDownloads.has(jobId)) {
                    const j = activeDownloads.get(jobId);
                    if (percent > j.progress) {
                        j.status = 'downloading';
                        j.progress = percent;
                    }
                }
            }
        }
    });

    child.stderr.on('data', (data) => {
        console.log(`[${jobId}] stderr: ${data}`);
    });

    child.on('close', async (code) => {
        if (!activeDownloads.has(jobId)) return;

        // CHECK SUCCESS EVEN ON ERROR CODE
        // yt-dlp might exit 1 if subtitles fail, but audio works.
        const expectedAudioPath = `${baseFileName}.mp3`;
        let finalAudioPath = expectedAudioPath;
        let audioExists = fs.existsSync(finalAudioPath);

        // Fallback search if exact path fail (rare with exact template)
        if (!audioExists) {
            const files = fs.readdirSync(DOWNLOAD_DIR);
            const match = files.find(f => f.includes(videoId) && /\.(mp3|m4a|webm|wav)$/i.test(f));
            if (match) {
                finalAudioPath = path.join(DOWNLOAD_DIR, match);
                audioExists = true;
            }
        }

        if (code !== 0 && !audioExists) {
            console.error(`[${jobId}] Process exited with code ${code} and file missing`);
            const job = activeDownloads.get(jobId);
            job.status = 'error';
            job.error = 'Download process failed';
            return;
        }

        const job = activeDownloads.get(jobId);
        job.status = 'processing';
        job.progress = 99;

        try {
            if (!audioExists) {
                throw new Error("Audio file not found (ID check failed)");
            }

            // Find Lyrics - Smart Selection
            let lyricContent = '';
            try {
                const dirFiles = fs.readdirSync(DOWNLOAD_DIR);
                const vttFiles = dirFiles.filter(f => f.includes(videoId) && f.endsWith('.vtt'));

                let vttFile;
                if (vttFiles.length > 0) {
                    // 1. Prefer Chinese (Manual/Auto)
                    vttFile = vttFiles.find(f => /zh|Hans|Hant/i.test(f));

                    // 2. If no Chinese, and song title effectively implies Chinese (basic guess), 
                    //    AND only English exists, maybe User prefers NO lyrics over Translated ones?
                    const isChineseTitle = /[\u4e00-\u9fa5]/.test(safeTitle);

                    if (!vttFile && !isChineseTitle) {
                        // If not Chinese title, accept English/Auto
                        vttFile = vttFiles.find(f => !f.includes('live_chat'));
                    }
                    // If it IS Chinese title, and we only have non-Chinese subs (likely English auto-transl),
                    // we intentionally skip choosing vttFile to return blank lyrics.
                    // (User request: "don't translate... keep chinese")
                }

                if (vttFile) {
                    lyricContent = fs.readFileSync(path.join(DOWNLOAD_DIR, vttFile), 'utf-8');
                }
            } catch (e) { console.error("Lyric Find Error", e); }

            const audioBuffer = fs.readFileSync(finalAudioPath);
            const stats = fs.statSync(finalAudioPath);

            job.status = 'completed';
            job.progress = 100;
            job.result = {
                audioBase64: audioBuffer.toString('base64'),
                lyrics: lyricContent,
                metadata: {
                    size: stats.size,
                    downloadDate: Date.now()
                }
            };

            // Keep the file in the downloads folder (User Request)
            // try { fs.unlinkSync(finalAudioPath); } catch (e) { }

        } catch (err) {
            console.error(`[${jobId}] Processing error:`, err);
            job.status = 'error';
            job.error = err.message || 'File processing failed';
        }
    });
}

const server = app.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    console.log(`Server is LIVE on ${address.address}:${address.port}`);
    console.log('App is ready to handle connections!');
});
