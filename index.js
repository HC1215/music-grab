const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytSearch = require('yt-search');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Serve Downloaded Music
const DOWNLOADS = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS)) fs.mkdirSync(DOWNLOADS);
app.use('/downloads', express.static(DOWNLOADS));

// 2. Serve the Player (Frontend)
const UI = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(UI)) {
    app.use(express.static(UI));
}

// 3. The Search Engine
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        const r = await ytSearch(q);
        res.json(r.videos.slice(0, 10));
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// 4. Health Check
app.get('/health', (req, res) => res.send('System Online'));

// 5. Fallback for Phone
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(UI, 'index.html'))) {
        res.sendFile(path.join(UI, 'index.html'));
    } else {
        res.send('<h1>Setting up app...</h1><p>Please refresh in 10 seconds.</p>');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Music App ready on port ${PORT}`);
});
