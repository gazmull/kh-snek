const { get } = require('snekfetch');
const mkdirp = require('mkdirp');
const path = require('path');
const { promisify } = require('util');
const { writeFile: wFile, stat: st } = require('fs');

const mkdir = promisify(mkdirp);
const writeFile = promisify(wFile);
const stat = promisify(st);

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
        await stat(path.join(filepath, filename));

        return true;
      } catch (e) {
        return false;
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Downloads the file.
   * @returns {Promise.<filePath>} - path of the downloaded file.
   */
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

    if (!url) throw { code: 'NOURI', message: 'No URL provided.' };
    else if (!destDirectory) throw { code: 'NODEST', message: 'No Destination Directory provided' };
    else if (!filename) throw { code: 'NONAME', message: 'No file name provided' };
    else if (await this.exists(destDirectory, filename)) throw { code: 'FEXIST', message: 'File already exists' };

    const data = await get(url, { headers });
    const file = data.body;

    if (!file || !data.ok)
      throw { code: 'URINOTOK', message: 'Cannot obtain file from the URL' };

    await writeFile(path.join(destDirectory, filename), file, 'binary');

    return path.join(destDirectory, filename);
  }
}

module.exports = FileDownloader;
