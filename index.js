require("dotenv").config();
const ytdl = require("@distube/ytdl-core");
const fs = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('node:path');
const readline = require('readline');

const baseDir = path.join(__dirname, "downloads");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));


/**
 * Makes Sure Directory Exists
 * @param {import("fs").PathLike} dir 
 */
function ensureDir(dir) {
    if (!(fs.existsSync(dir) && fs.statSync(dir).isDirectory())) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * 
 * @param {number} ms 
 * @returns {string}
 */
function prettyPrintMs(ms) {
    if (ms < 0) ms = -ms;

    const time = {
        day: Math.floor(ms / 86400000),
        hour: Math.floor(ms / 3600000) % 24,
        minute: Math.floor(ms / 60000) % 60,
        second: Math.floor(ms / 1000) % 60,
        millisecond: Math.floor(ms) % 1000,
    };

    const parts = [];
    if (time.day > 0) parts.push(`${time.day}d`);
    if (time.hour > 0) parts.push(`${time.hour}h`);
    if (time.minute > 0) parts.push(`${time.minute}m`);
    if (time.second > 0) parts.push(`${time.second}s`);
    if (time.millisecond > 0) parts.push(`${time.millisecond}ms`);

    return parts.join(' ') || '0ms';
}
/**
 * 
 * @param {string} time 
 * @returns {string}
 */
function formatTime(time) {
    const ms = Math.round(Number.parseInt(time) * 1000);

    return prettyPrintMs(ms);
}

/**
 * 
 * @param {string} videoUrl 
 * @param {string} outputDir 
 */
async function downloadVideoAsMp3(videoUrl, outputDir) {
    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;

        const outputPath = path.join(outputDir, `${sanitizeFilename(title)}.mp3`);


        // Create a read stream from ytdl
        const stream = ytdl(videoUrl, { filter: 'audioonly' });

        console.log(`Downloading: ${title} ${info.videoDetails.author.name.replace("- Topic", "")} ${formatTime(info.videoDetails.lengthSeconds)}`);

        // Create an ffmpeg command to convert the audio stream to MP3
        await new Promise((resolve, reject) => {
            ffmpeg(stream)
                .audioBitrate(128)
                .save(outputPath)
                .on('end', () => {
                    console.log(`Downloaded and converted: ${title}`);
                    resolve()
                })
                .on('error', err => {
                    console.error(`Error converting ${title}:`, err);
                    reject(err);
                });
        })
    } catch (error) {
        console.error('Error downloading video:', error);
    }
}

/**
 * 
 * @param {string} playlistUrl 
 * @param {string} outputDir 
 */
async function downloadPlaylistAsAlbum(playlistUrl, outputDir) {
    // because node-fetch is an ESM module, we need to import it dynamically and if its not a playlist we don't need to import it anyway
    let fetch = await import('node-fetch');
    fetch = fetch.default;
    // console.log('fetch', fetch);
    // Fetch the playlist id
    const playlistId = extractPlaylistId(playlistUrl);
    const apiKey = process.env.YOUTUBE_API_KEY;

    // just a url with the playlist id
    const playlistInfoUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${apiKey}&maxResults=50`;

    try {
        const response = await fetch(playlistInfoUrl);

        const { items } = await response.json();

        if (!items || !(items?.length)) {
            console.error('No items found in playlist');
            return;
        }

        for (const item of items) {
            const videoUrl = `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`;
            await downloadVideoAsMp3(videoUrl, outputDir);

            await sleep(1000);  // sleep for a second to avoid rate limiting
        }

        console.log(`Downloaded playlist as album to: ${outputDir}`);
    } catch (error) {
        console.error('Error downloading playlist:', error);
    }
}

/**
 * 
 * @param {string} url 
 * @returns {string | null}
 */
function extractPlaylistId(url) {
    const match = url.match(/list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

/**
 * 
 * @param {string} filename 
 * @returns {string}
 */
function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * 
 * @param {string} question 
 * @returns  {Promise<string>}
 */
const getInput = (question) => new Promise(r => rl.question(question, r));


async function main() {
    ensureDir(baseDir);

    const url = await getInput('Enter the YouTube video or playlist URL: ');
    const outputDirname = await getInput('Enter the output directory: ');

    const outputDir = path.join(baseDir, sanitizeFilename(outputDirname));

    ensureDir(outputDir);

    if (url.includes('playlist?list=')) {
        await downloadPlaylistAsAlbum(url, outputDir);
    } else {
        await downloadVideoAsMp3(url, outputDir);
    }

    rl.close();

    console.log(`Downloaded to: ${outputDir}`);
}

main();