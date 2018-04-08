const Downloader = require('./Downloader');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');

const readDirectory = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(require('mkdirp'));

class Extractor {
  constructor(options) {
    this.base = options.base;

    this.codes = options.codes;

    this.characters = {
      soul: [],
      eidolon: [],
      ssra: [],
      ssr: [],
      sr: [],
      r: []
    };

    this.links = { '0000': { misc: [] } };

    this.charactersExtracted = 0;

    this.charactersFound = 0;

    this.filesDownloaded = 0;

    this.filesFound = 0;

    this.errors = [];
  }

  async execute() {
    const categories = await readDirectory(this.base.scripts);

    for (const category of categories) {
      const charactersDir = `${this.base.scripts}${category}/`;
      const characters = await readDirectory(charactersDir);
      this.charactersFound += characters.length;
      this.charactersExtracted += await this.extract(charactersDir, characters);

      await this.download(category);
    }

    await writeFile(`${this.base.destination}/config.json`, JSON.stringify(this.characters, null, 2));

    if (this.errors.length)
      await writeFile(`${process.cwd()}/assets_download-error-stack.log`, this.errors.join('\r\n').replace(/\n/g, '\n'));

    this.progress([
      `Extracted ${this.charactersExtracted} characters. (Expected: ${this.charactersFound})`,
      `Downloaded ${this.filesDownloaded} files. (Expected: ${this.filesFound})`,
      this.errors.length
        ? 'I have detected some errors during the process. Error log can be found at assets_download-error-stack.log.'
        : ''
    ]);

    return true;
  }

  async download(category) {
    for (const chara in this.links)
      for (let resourceDirectory in this.links[chara]) {
        const resourceID = resourceDirectory;
        resourceDirectory = this.links[chara][resourceDirectory];
        const resLength = resourceDirectory.length;
        this.filesFound += resourceDirectory.length;

        for (const url of resourceDirectory) {
          if (!url) continue;

          const urlIndex = resourceDirectory.indexOf(url);
          const name = url.split('/').pop();
          const fileInfo = new Downloader({
            url,
            destination: `${this.base.destination}${chara}/${resourceID}/`,
            name
          });

          this.progress(`Downloading ${chara}... [${urlIndex} / ${resLength}]`);

          try {
            await fileInfo.download();

            this.filesDownloaded++;
          } catch (f) {
            if (f.code !== 'FEXIST')
              this.errors.push(`${new Date().toLocaleString()}: [${category}: ${chara}]\n  ${url}\n  ${f.code === 'ENOENT' ? 'Outdated script. Please get a new one!' : f.stack}`);
          }
        }
      }
  }

  async extract(dir, characters) {
    const type = dir.split('/').slice(-2).shift();
    let name;

    for (const character of characters) {
      let scripts = await readDirectory(`${dir}/${character}/`);

      scripts = scripts.sort((a, b) => {
        const x = parseInt(a.split('_').shift());
        const y = parseInt(b.split('_').shift());

        return x - y;
      });

      this.links[character] = {};

      this.progress(`Extracting  ${character}...`);
      this.characters[type].push({
        name: character,
        intro: { title: null, summary: null, resource: null },
        harem1: { title: null, summary: null, resource: null, resource2: null },
        harem2: { title: null, summary: null, resource: null, resource2: null }
      });

      for (const script of scripts) {
        const data = JSON.parse(await readFile(`${dir}/${character}/${script}`));

        if (!(data.scenario || data.scene_data)) continue;

        let scenario = [];
        const chara = {};
        const scriptIndex = scripts.indexOf(script);
        const charIndex = () => this.characters[type].findIndex(i => i.name === character);
        const superType = ['ssra', 'ssr', 'sr', 'r'].includes(type) ? 'kamihime' : type;

        if (data.scenario) {
          const resourceDirectory = data.resource_directory;

          if (!this.links[character][resourceDirectory])
            this.links[character][resourceDirectory] = [];

          if ([0, 1, 3].includes(scriptIndex))
            Object.assign(this.characters[type][charIndex()], {
              [scriptIndex === 0
                ? 'intro'
                : scriptIndex === 1
                  ? 'harem1'
                  : 'harem2'
              ]: {
                title: data.title,
                summary: data.summary,
                resource: resourceDirectory
              }
            });

          const entries = data.scenario.split('\n');

          for (let entry of entries) {
            const miscChar = ['*', '#', 'Tap to continue'].some(i => entry.startsWith(i));

            if (miscChar) continue;

            if (entry.startsWith('[')) {
              entry = entry.replace(/[[\]"]/g, '').split(' ');

              if (entry.length < 2) continue;

              const line = { command: entry.shift() };

              for (let record of entry) {
                record = record.split('=');
                const [command, arg] = record;

                if (record.length === 2)
                  line[command] = arg;
              }

              const charaName = chara[line.name];

              switch (line.command) {
                case 'chara_new': {
                  this.links['0000'].misc.push(this.base.url.fgImage + line.storage);
                  Object.assign(chara, { [line.name]: { name: line.jname } });
                  break;
                }

                case 'chara_face': {
                  this.links['0000'].misc.push(this.base.url.fgImage + line.storage);

                  if (!chara[line.name].face)
                    Object.assign(charaName, { face: {} });

                  Object.assign(charaName.face, { [line.face]: line.storage });
                  break;
                }

                case 'playbgm': {
                  this.links['0000'].misc.push(this.base.url.bgm + line.storage);
                  scenario.push({ bgm: line.storage });
                  break;
                }

                case 'bg': {
                  const irrBG = ['white', 'black', 'tomei'].some(i => line.storage.startsWith(i));

                  if (irrBG) continue;

                  this.links['0000'].misc.push(this.base.url.bgImage + line.storage);
                  scenario.push({ bg: line.storage });
                  break;
                }

                case 'chara_show': {
                  name = charaName.name;
                  break;
                }

                case 'chara_mod': {
                  scenario.push({ expression: charaName.face[line.face] });
                  break;
                }

                case 'playse': {
                  const isGetIntro = ['h_get', 'h_intro'].some(i => line.storage.startsWith(i));

                  if (!isGetIntro) continue;

                  this.links[character][resourceDirectory].push(
                    `${this.base.url.scenarios}${this.codes[superType].intro}${resourceDirectory}/sound/${line.storage}`
                  );
                  scenario.push({ voice: line.storage });
                  break;
                }
              }
            } else {
              const text = entry
                .replace(/(["%])/g, '\\$&')
                .replace(/\[l\]|\[r\]|\[cm\]|^;.+/g, '')
                .replace(/(\.{1,3})(?=[^\s\W])/g, '$& ')
                .replace(/&nbsp;/gi, ' ');
              const invalidTalk = (text.replace(/ /g, '')).length < 2;

              if (invalidTalk) continue;

              scenario.push({ chara: name.replace(/&nbsp;/gi, ' '), words: text });
            }
          }

          const tmp = scenario;
          let sequence = {};
          let lastBG = null;
          let lastBGM = null;
          scenario = [];

          for (const entry of tmp) {
            const key = Object.keys(entry)[0];

            if (key === 'chara')
              Object.assign(sequence, { chara: entry.chara, words: entry.words });
            else {
              Object.assign(sequence, { [key]: entry[key] });

              if (key === 'bg')
                lastBG = entry[key];

              if (key === 'bgm')
                lastBGM = entry[key];
            }

            if (!sequence.bg)
              Object.assign(sequence, { bg: lastBG });

            if (!sequence.bgm)
              Object.assign(sequence, { bgm: lastBGM });

            if (sequence.chara) {
              scenario.push(sequence);

              sequence = {};
              continue;
            }
          }
        } else {
          const resourceDirectory = data.resource_directory;

          if ([2, 4].includes(scriptIndex))
            Object.assign(this.characters[type][charIndex()][
              scriptIndex === 2
                ? 'harem1'
                : 'harem2'
            ], { resource2: resourceDirectory });

          if (!this.links[character].hasOwnProperty(resourceDirectory))
            this.links[character][resourceDirectory] = [];

          for (const entry of data.scene_data) {
            const entryData = {};

            if (entry.bgm) {
              this.links[character][resourceDirectory].push(
                `${this.base.url.scenarios}${this.codes[superType].scene}${resourceDirectory}/${entry.bgm}`
              );

              Object.assign(entryData, { bgm: entry.bgm });
            }

            if (entry.film) {
              this.links[character][resourceDirectory].push(
                `${this.base.url.scenarios}${this.codes[superType].scene}${resourceDirectory}/${entry.film}`
              );

              const fps = Number(entry.fps);

              Object.assign(entryData, {
                sequence: entry.film,
                seconds: fps === 1 || fps === 16
                  ? 1
                  : fps === 24
                    ? '0.67'
                    : 2,
                steps: fps === 1 ? 1 : 16
              });
            }

            const talkData = [];

            for (const line of entry.talk) {
              const talkEntry = {};

              if (line.voice) {
                this.links[character][resourceDirectory].push(
                  `${this.base.url.scenarios}${this.codes[superType].scene}${resourceDirectory}/${line.voice}`
                );

                if (line.voice.length)
                  Object.assign(talkEntry, { voice: line.voice });
              }

              line.words = line.words
                .replace(/[[\]"]/g, '')
                .replace(/(\.{1,3}|…)(?=[^\s\W])/g, '$& ');
              line.chara = line.chara
                .replace(/(["%])/g, '\\$&');

              Object.assign(talkEntry, { chara: line.chara, words: line.words });

              const dataMax = data.scene_data.length - 1;
              const lineMax = entry.talk.length - 1;

              if (data.scene_data.indexOf(entry) === dataMax && entry.talk.indexOf(line) === lineMax)
                Object.assign(talkEntry, { toIndex: true });

              talkData.push(talkEntry);
            }

            Object.assign(entryData, { talk: talkData });

            scenario.push(entryData);
          }
        }

        await mkdirp(`${this.base.destination}${character}/${data.resource_directory}/`);
        await writeFile(`${this.base.destination}${character}/${data.resource_directory}/script.json`, JSON.stringify({ scenario }, null, 2));
      }

      this.progress(`Extracted ${character}`);
    }

    return this.characters[type].length;
  }

  progress(message) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);

    return process.stdout.write(Array.isArray(message) ? message.join('\n') : message);
  }
}

module.exports = Extractor;
