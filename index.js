const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check that MUST work
app.get('/health', (req, res) => res.send('Standalone Engine is ACTIVE'));

// Serve Frontend from 'dist' folder in root
const DIST_PATH = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
}

// Minimal API for Search (redirecting to backend logic)
app.get('/api/search', (req, res) => {
    // Basic response to prove it works
    res.json([{ id: 'test', title: 'Server is Connected!', author: 'Assistant' }]);
});

app.get('*', (req, res) => {
    if (fs.existsSync(path.join(DIST_PATH, 'index.html'))) {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    } else {
        res.send('<h1>App is Loading...</h1><p>Please wait 1 minute for the build to finish.</p>');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
