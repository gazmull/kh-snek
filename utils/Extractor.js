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

    this.blacklist = [];

    this.charactersExtracted = 0;

    this.charactersFound = 0;

    this.filesDownloaded = 0;

    this.filesFound = 0;

    this.errors = [];

    this._scenario = [];

    this._model = {};
  }

  async execute() {
    const categories = await readDirectory(this.base.scripts);

    for (const category of categories) {
      const charactersDir = `${this.base.scripts}${category}/`;
      const characters = await readDirectory(charactersDir);
      this.charactersFound += characters.length;
      this.charactersExtracted += await this.extract(charactersDir, characters);
    }

    await writeFile(`${this.base.destination}/config.json`, JSON.stringify(this.characters, null, 2));

    if (await Downloader.exists(process.cwd(), 'blacklist.array'))
      this.blacklist = (await readFile(`${process.cwd()}/blacklist.array`, 'utf8')).split('\n');

    await this.download();

    if (this.errors.length)
      await writeFile(`${process.cwd()}/assets_download-error-stack.log`, this.errors.join('\r\n').replace(/\n/g, '\n'));

    if (this.blacklist.length)
      await writeFile(`${process.cwd()}/blacklist.array`, this.blacklist.join('\n'));

    this.progress([
      `Extracted ${this.charactersExtracted} characters. (Expected: ${this.charactersFound})`,
      `Downloaded ${this.filesDownloaded} files. (Expected: ${this.filesFound})`,
      this.errors.length
        ? 'I have detected some errors during the process. Error log can be found at assets_download-error-stack.log.'
        : ''
    ]);

    return true;
  }

  async download() {
    for (const chara in this.links)
      for (let resourceDirectory in this.links[chara]) {
        const resourceID = resourceDirectory;
        resourceDirectory = this.links[chara][resourceDirectory];
        const resLength = resourceDirectory.length;
        this.filesFound += resourceDirectory.length;

        for (const url of resourceDirectory) {
          if (!url) continue;
          else if (this.blacklist.includes(url)) continue;

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
              this.errors.push(`${new Date().toLocaleString()}: [${chara}]\n  ${url}\n  ${f.code === 'ENOENT' ? 'Outdated script. Please get a new one!' : f.stack}`);

            if (f.status === 404)
              this.blacklist.push(url);
          }
        }
      }
  }

  async extract(dir, characters) {
    const type = dir.split('/').slice(-2).shift();

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

        if (!(data.scenario || data.scene_data || data.scenario_path)) continue;

        const charIndex = () => this.characters[type].findIndex(i => i.name === character);
        const scriptIndex = scripts.indexOf(script);
        const superType = ['ssra', 'ssr', 'sr', 'r'].includes(type) ? 'kamihime' : type;
        const {
          resource_directory: resourceDirectory,
          title,
          summary
        } = data;

        if (data.scenario)
          this.doScenario({
            data,
            character,
            type,
            charIndex,
            scriptIndex,
            superType,
            resourceDirectory,
            title,
            summary
          });
        else if (data.scene_data)
          this.doSceneData({
            data,
            character,
            type,
            charIndex,
            scriptIndex,
            superType,
            resourceDirectory
          });
        else {
          let mainData = await new Downloader({ url: `${this.base.url.scenarios}${data.scenario_path}` }).download(true);
          const isStory = [0, 1, 3].includes(scriptIndex);
          const dummyName = new RegExp('{{主人公}}', 'g');

          mainData = mainData.toString();
          mainData = mainData.replace(dummyName, 'Successor');

          if (isStory)
            this.doScenario({
              mainData,
              character,
              type,
              charIndex,
              scriptIndex,
              superType,
              resourceDirectory,
              title,
              summary
            });
          else {
            mainData = mainData.slice(0, mainData.length - 1);
            mainData = mainData.replace(/(.*?),\s*(\}|])/g, '$1$2');
            mainData = JSON.parse(mainData);

            this.doSceneData({
              mainData,
              character,
              charIndex,
              scriptIndex,
              type,
              superType,
              resourceDirectory
            });
          }
        }

        await mkdirp(`${this.base.destination}${character}/${data.resource_directory}/`);
        await writeFile(`${this.base.destination}${character}/${data.resource_directory}/script.json`, JSON.stringify({ scenario: this._scenario, model: this._model }, null, 2));

        if (!this.characters[type][charIndex()].model && scriptIndex === 1)
          Object.assign(this.characters[type][charIndex()], { model: this._model[Object.keys(this._model)[0]] });
      }

      this.progress(`Extracted ${character}`);
    }

    return this.characters[type].length;
  }

  doScenario(resources) {
    const {
      character,
      type,
      scriptIndex,
      charIndex,
      superType,
      resourceDirectory,
      title,
      summary
    } = resources;
    this._scenario = [];
    this._model = {};
    const chara = {};
    let name;

    const data = resources.data ? resources.data.scenario : resources.mainData;

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
          title,
          summary,
          resource: resourceDirectory
        }
      });

    const entries = data.split('\n');

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
            this._scenario.push({ bgm: line.storage });
            break;
          }

          case 'bg': {
            const irrBG = ['white', 'black', 'tomei'].some(i => line.storage.startsWith(i));

            if (irrBG) continue;

            this.links['0000'].misc.push(this.base.url.bgImage + line.storage);
            this._scenario.push({ bg: line.storage });
            break;
          }

          case 'chara_show': {
            name = charaName.name;
            break;
          }

          case 'chara_mod': {
            this._scenario.push({ expression: charaName.face[line.face] });
            break;
          }

          case 'playse': {
            const isGetIntro = ['h_get', 'h_intro'].some(i => line.storage.startsWith(i));

            if (!isGetIntro) continue;

            this.links[character][resourceDirectory].push(
              superType === 'soul'
                ? `${this.base.url.scenarios}${this.codes[superType].get}${resourceDirectory}/sound/${line.storage}`
                : `${this.base.url.scenarios}${this.codes[superType].intro}${resourceDirectory}/sound/${line.storage}`
            );
            this._scenario.push({ voice: line.storage });
            break;
          }

          case 'chara_hide': {
            name = ' ';
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

        this._scenario.push({ chara: name ? name.replace(/&nbsp;/gi, ' ') : name, words: text });
      }
    }

    const tmp = this._scenario;
    let sequence = {};
    let lastBG = null;
    let lastBGM = null;
    this._scenario = [];

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
        sequence.chara = sequence.chara.replace(/[ ]/g, ' '); // eslint-disable-line no-irregular-whitespace

        if (character.includes(sequence.chara) && !this._model[sequence.chara])
          Object.assign(this._model, { [sequence.chara]: sequence.expression });

        this._scenario.push(sequence);

        sequence = {};
      }
    }
  }

  doSceneData(resources) {
    const {
      character,
      type,
      charIndex,
      scriptIndex,
      superType,
      resourceDirectory
    } = resources;
    this._scenario = [];

    const data = resources.data ? resources.data.scene_data : resources.mainData;

    if ([2, 4].includes(scriptIndex))
      Object.assign(this.characters[type][charIndex()][
        scriptIndex === 2
          ? 'harem1'
          : 'harem2'
      ], { resource2: resourceDirectory });

    if (!this.links[character].hasOwnProperty(resourceDirectory))
      this.links[character][resourceDirectory] = [];

    for (const entry of data) {
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

        const dataMax = data.length - 1;
        const lineMax = entry.talk.length - 1;

        if (data.indexOf(entry) === dataMax && entry.talk.indexOf(line) === lineMax)
          Object.assign(talkEntry, { toIndex: true });

        talkData.push(talkEntry);
      }

      Object.assign(entryData, { talk: talkData });

      this._scenario.push(entryData);
    }
  }

  progress(message) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);

    return process.stdout.write(Array.isArray(message) ? message.join('\n') : message);
  }
}

module.exports = Extractor;
