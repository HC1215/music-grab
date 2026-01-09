const ffmpeg = require('ffmpeg-static');
console.log('FFmpeg Path:', ffmpeg);
const fs = require('fs');
console.log('Exists:', fs.existsSync(ffmpeg));
