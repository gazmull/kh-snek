const Downloader = require('./Downloader');
const fs = require('fs');
const { promisify } = require('util');

class Extractor {
  constructor(options) {
    /* eslint-disable global-require */

    this.get = require('snekfetch').get;

    this.readDirectory = promisify(fs.readdir);

    this.readFile = promisify(fs.readFile);

    this.writeFile = promisify(fs.writeFile);

    this.mkdirp = promisify(require('mkdirp'));

    /* eslint-enable global-require */

    this.base = options.base;

    this.codes = options.codes;

    this.links = { '0000': { misc: [] } };

    this.filesDownloaded = 0;

    this.filesFound = 0;

    this.errors = [];
  }

  async execute() {
    const { get, readDirectory, readFile, writeFile, base, codes, links, errors } = this;
    const characters = await readDirectory(base.scripts);
    let { filesDownloaded, filesFound } = this;

    for (const character of characters) {
      const characterScripts = `${base.scripts}${character}/`;
      const scripts = await readDirectory(characterScripts);
      const splitChar = character.split('_');
      const [type] = splitChar;
      let [, name] = splitChar;
      let id = null;
      let names = await get(`${base.url.api}search?name=${character.split('_').pop()}`);
      names = names.body;

      if (!names.length)
        continue;

      else if (names.length === 1)
        id = names.shift().khID;

      else
        for (const i of names)
          if (i.khName.toLowerCase() === name.toLowerCase())
            id = i.khID;

      links[id] = {};

      for (const script of scripts) {
        const data = JSON.parse(await readFile(`${characterScripts}${script}`));

        let scenario = [];
        const chara = {};

        if (data.scenario) {
          const resourceDirectory = data.resource_directory;

          if (!links[id][resourceDirectory])
            links[id][resourceDirectory] = [];

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
                  links['0000'].misc.push(base.url.fgImage + line.storage);

                  Object.assign(chara, { [line.name]: { name: line.jname } });

                  break;
                }

                case 'chara_face': {
                  links['0000'].misc.push(base.url.fgImage + line.storage);

                  if (!chara[line.name].face)
                    Object.assign(charaName, { face: {} });

                  Object.assign(charaName.face, { [line.face]: line.storage });

                  break;
                }

                case 'playbgm': {
                  links['0000'].misc.push(base.url.bgm + line.storage);

                  scenario.push({ bgm: line.storage });

                  break;
                }

                case 'bg': {
                  const irrBG = ['white', 'black', 'tomei'].some(i => line.storage.startsWith(i));

                  if (irrBG) continue;

                  links['0000'].misc.push(base.url.bgImage + line.storage);

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

                  links[id][resourceDirectory].push(
                    `${base.url.scenarios}${codes[type].intro}${resourceDirectory}/sound/${line.storage}`
                  );

                  scenario.push({ voice: line.storage });
                  break;
                }

                // case 'chara_hide': {
                //   scenario.push({ chara: null, words: null });

                //   break;
                // }
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
        } else if (data.scene_data) {
          const resourceDirectory = data.resource_directory;

          if (!links[id].hasOwnProperty(resourceDirectory))
            links[id][resourceDirectory] = [];

          for (const entry of data.scene_data) {
            const entryData = {};

            if (entry.bgm) {
              links[id][resourceDirectory].push(
                `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${entry.bgm}`
              );

              Object.assign(entryData, { bgm: entry.bgm });
            }

            if (entry.film) {
              links[id][resourceDirectory].push(
                `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${entry.film}`
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
                links[id][resourceDirectory].push(
                  `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${line.voice}`
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

        await this.mkdirp(`${base.destination}${id}/${data.resource_directory}/`);
        await writeFile(`${base.destination}${id}/${data.resource_directory}/script.json`, JSON.stringify({ scenario }, null, 2));
      }

      for (const chara in links)
        for (let resourceDirectory in links[chara]) {
          const resourceID = resourceDirectory;
          resourceDirectory = links[chara][resourceDirectory];
          filesFound += resourceDirectory.length;

          for (const url of resourceDirectory) {
            if (!url) continue;

            const fileInfo = new Downloader({
              url,
              destination: `${base.destination}${chara}/${resourceID}/`,
              name: url.split('/').pop()
            });

            try {
              const file = await fileInfo.download();

              console.log('Downloaded Successfully -> ', chara, file);

              filesDownloaded++;
            } catch (f) {
              console.log('Error: ', f.code === 'ENOENT' ? 'Outdated script. Please get a new one!' : f.message, `-> ${chara} (${url})`);

              if (f.code !== 'FEXIST')
                errors.push(`${new Date().toLocaleString()}: [${type}: ${name} (${id})]\n  ${url}\n  ${f.code === 'ENOENT' ? 'Outdated script. Please get a new one!' : f.stack}`);
            }
          }
        }
    }

    if (errors.length)
      await writeFile(`${process.cwd()}/assets_download-error-stack.log`, errors.join('\r\n').replace(/\n/g, '\r\n'));

    return {
      message: [
        `Extracted ${Object.keys(links).length - 1} characters. (Expected: ${characters.length})`,
        `Downloaded ${filesDownloaded} files. (Expected: ${filesFound})`,
        errors.length
          ? 'I have detected some errors during the process. Error log can be found at assets_download-error-stack.log.'
          : ''
      ]
    };
  }
}

module.exports = Extractor;
