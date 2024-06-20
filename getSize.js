const fs = require('node:fs');
const path = require('node:path');

const downloadsDir = path.join(__dirname, "downloads");



/**
 * 
 * @param {import("fs").PathLike} file 
 * @returns {Promise<number>}
 */
async function getSize(file) {
    return (await fs.promises.stat(file)).size;
}

/**
 * 
 * @param {import("fs").PathLike} dir 
 * @returns {Promise<number>}
 */
async function getDirSize(dir) {
    let size = 0;


    let list = fs.readdirSync(dir);

    for (let entry of list) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            size += await getDirSize(full);
        } else {
            size += await getSize(full);
        }
    }

    return size;
}

async function main(dir) {
    let total = await getDirSize(dir);

    // bytes to megabytes
    total = total / 1024 / 1024;

    // round to 2 decimal places
    total = Math.round(total * 100) / 100;

    console.log(`Total Size: ${total} MB`);
}

main(downloadsDir)