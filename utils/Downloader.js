const { get } = require('snekfetch');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);
const open = promisify(fs.open);

class FileDownloader {
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
    const destDirectory = this.options.destDirectory;
    const filename = this.options.filename;

    try {
      if (!url) throw new Error('No URL provided.');
      else if (!destDirectory) throw new Error('No Destination Directory provided.');
      else if (!filename) throw new Error('No file name provided.');
      else if (await this.exists(destDirectory, filename)) throw new Error('File already exists.');

      const data = await get(url);
      const file = data.body;

      if (!file || !data.ok)
        throw new Error('Cannot obtain file from the URL.');

      await writeFile(path.join(destDirectory, filename), file, 'binary');

      return path.join(destDirectory, filename);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = FileDownloader;
