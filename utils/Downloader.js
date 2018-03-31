const { get } = require('snekfetch');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);
const open = promisify(fs.open);

class FileDownloader {

  /**
   * @typedef {Object} DownloaderOptions
   * @property {string} url URL of the file.
   * @property {string} destination Destination path of the file.
   * @property {string} name File's name to save as.
   */

  /**
   * @param {DownloaderOptions} options Options for Downloader.
   */
  constructor(options = {}) {
    if (typeof options !== 'object') throw new Error('Options must be an object type.');

    this.options = options;
  }

  async exists(filepath, filename) {
    try {
      await mkdir(filepath);
      try {
        await open(path.join(filepath, filename), 'r+');

        return true;
      } catch (e) {
        return false;
      }
    } catch (err) {
      throw err;
    }
  }

  async download() {
    const url = this.options.url;
    const destDirectory = this.options.destination;
    const filename = this.options.name;
    const headers = {
      'user-agent': [
        'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
        'AppleWebKit/537.36 (KHTML, like Gecko)',
        'Chrome/58.0.3029.110 Safari/537.36'
      ].join(' ')
    };

    if (!url) throw new Error('No URL provided.');
    else if (!destDirectory) throw new Error('No Destination Directory provided');
    else if (!filename) throw new Error('No file name provided');
    else if (await this.exists(destDirectory, filename)) throw new Error('File already exists');

    const data = await get(url, { headers });
    const file = data.body;

    if (!file || !data.ok)
      throw new Error('Cannot obtain file from the URL');

    await writeFile(path.join(destDirectory, filename), file, 'binary');

    return path.join(destDirectory, filename);
  }
}

module.exports = FileDownloader;
