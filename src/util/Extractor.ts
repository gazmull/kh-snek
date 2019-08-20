import Zip from 'jszip';
import * as Knex from 'knex';
import fetch from 'node-fetch';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/dist/sftp'; // Need to fork this to update wrong types
import { Logger } from 'winston';
import { IExtractorFiles, IExtractorOptions, IHaremResources, IScenarioSequence } from '../../typings';
import Downloader from './Downloader';
import GithubGist from './GithubGist';
import ImageProcessor from './ImageProcessor';

// tslint:disable-next-line:no-var-requires
const ssh = new SSH2Promise(require('../../auth').ssh);
let sftp: SFTP;
const convert = new ImageProcessor();

const headers = {
  'User-Agent': [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'AppleWebKit/537.36 (KHTML, like Gecko)',
    'Chrome/74.0.3729.169 Safari/537.36',
  ].join(' '),
  Cookie: ''
};

export default class Extractor {
  constructor (options: IExtractorOptions) {
    this.base = options.base;

    this.db = options.db;

    this.logger = options.logger;

    this.files = {};

    this.miscFiles = [];

    this.blacklist = [];

    this.resources = {};

    this.resourcesExtracted = 0;

    this.resourcesFound = 0;

    this.filesFound = 0;

    this.error = false;

    headers.Cookie = `XSRF-TOKEN=${options.grant.xsrf};session=${options.grant.session}`;
  }

  public base: IExtractorOptions['base'];
  public db: Knex;
  public files: IExtractorFiles;
  public miscFiles: string[];
  public blacklist: string[];
  public resources: { [id: string]: IHaremResources; };
  public resourcesExtracted: number;
  public resourcesFound: number;
  public filesFound: number;
  public error: boolean;
  public logger: Logger;
  public verbose: boolean;

  public async exec () {
    try {
      this.logger.info('Connecting to remote server via SSH...');
      await ssh.connect();
      sftp = ssh.sftp();

      this.logger.info('Connected to remote server via SSH.');
    } catch (err) { throw new Error(err); }

    for (const character of this.base.characters) {
      const { id, name } = character;

      if (!this.files[id])
        this.files[id] = {
          name,
          resources: {}
        };

      this.logger.info(`Obtaining episodes for ${id}...`);

      const resources = await this._getEpisodes(id);
      this.resourcesFound += resources.length;
      this.resourcesExtracted += await this._extract(id, resources);
    }

    this.blacklist = await GithubGist();

    await this._download();

    this.logger.info([
      // tslint:disable-next-line: max-line-length
      `Extracted ${this.resourcesExtracted} resources from ${this.base.characters.length} characters. (Expected: ${this.resourcesFound})`,
      `Files Found: ${this.filesFound}`,
      this.error
        ? [
          'I have detected some errors during the process.',
          `Error log can be found at ${process.cwd()}\\logs\\error.log`,
        ].join('\n')
        : '',
    ].join('\n'));

    return true;
  }

  // -- Utils

  private async _getEpisodes (id: string) {
    try {
      let res: string[];

      if (id.startsWith('s')) {
        res = await this._extractFromEpisodes(id);

        return res;
      }

      const url = this.base.URL[id.startsWith('e') ? 'EIDOLONS' : 'KAMIHIMES'].SCENES + id.slice(1);
      const request = await fetch(url, { headers });

      if (!request.ok) throw new Error(`Received HTTP status: ${request.status}`);

      const json = await request.json();

      if (json.errors) throw new Error(json.errors[0].message);

      res = await this._extractFromEpisodes(id, Number(/^(\d+)_harem/.exec(json.episode_id)[1]));

      return res;
    } catch (err) {
      this.error = true;
      this.logger.error(`[${id}] \n ${err.stack}`);

      return [];
    }
  }

  private async _extractFromEpisodes (id: string, episodeId?: number) {
    let episodes: number[];
    const result: IHaremResources = {};

    // -- If empty episodeId, it assumes passed ID is a soul's ID
    if (!episodeId) {
      const predicted = Number(id.slice(1)) * 2;
      episodes = [ predicted - 1, predicted ];
    } else if ([ 'SSR+', 'R' ].includes(this.base.characters.find(i => i.id === id).rarity) || id.startsWith('e'))
      episodes = [ episodeId - 1, episodeId ];
    else
      episodes = [ episodeId - 1, episodeId, episodeId + 1 ];

    for (const episode of episodes)
      try {
        const url = [
          this.base.URL.EPISODES,
          episode,
          `_harem-${id.startsWith('s') ? 'job' : id.startsWith('e') ? 'summon' : 'character'}`,
        ].join('');
        const request = await fetch(url, { headers });

        if (!request.ok) throw new Error(`Received HTTP status: ${request.status}`);

        const json = await request.json();

        if (json.errors) throw new Error(json.errors[0].message);

        const { scenarios, harem_scenes: scenes } = json.chapters[0];

        if (!scenes) result.harem1Resource1 = scenarios[0].resource_directory;
        else if (scenes && episodes.indexOf(episode) === 1) {
          result.harem2Resource1 = scenarios[0].resource_directory;
          result.harem2Resource2 = scenes[0].resource_directory;
        } else {
          result.harem3Resource1 = scenarios[0].resource_directory;
          result.harem3Resource2 = scenes[0].resource_directory;
        }
      } catch (err) {
        this.error = true;
        this.logger.error(`[${id}] \n ${err.stack}`);

        continue;
      }

    const resValues = Object.values(result);

    for (const resource of resValues)
      Object.assign(this.files[id].resources, { [resource]: [] });

    Object.assign(this.resources, { [id]: result });

    return resValues;
  }

  // WIP
  private async _download () {
    // Two sections (Story / Scenario) will be processed in different way.
    // Refactor this when you're not lazy enough
    // ~~Not yet tested. Test this! (Specially SFTPs)~~
    // Already tested but seems the process is way too slow.
    // Deciding to divide this into two branch:
    //   master: Download all assets and process scripts
    //   *: Process the images

    // Story Character Expressions/BGM/BG
    let current = 1;
    for (const url of this.miscFiles) {
      if (this.blacklist.includes(url)) continue;

      const destination = `${this.base.DESTINATION.EPISODES}misc`;
      const name = url.split('/').pop();
      const file = new Downloader({ url });

      this.logger.info(`Downloading Story assets... [${current} / ${this.miscFiles.length}]`);

      try {
        const fileBuffer = await file.download(true) as Buffer;

        await ssh.exec(`mkdir -p ${destination}`);
        // @ts-ignore
        await sftp.writeFile(`${destination}/${name}`, fileBuffer, { encoding: 'binary' });
        this.logger.info(`Successfully written ${name} to server`);

        if (/\.(?:jpe?g|png)$/.test(name)) {
          await convert.writeWebpToServer(fileBuffer, { server: sftp, path: `${destination}/${name}` });
          this.logger.info(`Successfully written ${name}.webp to server`);
        }

        current++;
      } catch (f) {
        this.error = true;
        this.logger.error(`[MISC]\n  [${url}]\n  ${f.stack}`);
      }
    }

    // Story-Specific Assets / Scenario
    for (const id of Object.keys(this.files)) {
      const resourceDirectories = this.files[id].resources;
      const characterName = this.files[id].name;

      this.logger.debug(`Downloading resource assets for ${id}...`);

      for (const resourceDirectory of Object.keys(resourceDirectories)) {
        const urls = resourceDirectories[resourceDirectory];
        const filenames: string[] = [];
        const zip = new Zip();
        current = 1;
        this.filesFound += urls.length;

        this.logger.debug(`Downloading ${resourceDirectory} assets...`);

        for (const url of urls) {
          if (this.blacklist.includes(url)) continue;

          const destination = `${this.base.DESTINATION.EPISODES}${id}/${resourceDirectory}`;
          const name = url.split('/').pop();
          const file = new Downloader({ url });

          this.logger.info(`Downloading Scenario ${id}... [${current} / ${urls.length}]`);

          // continue here where you need to:
          // convert to gif
          // put gif files into a zip then send it to server (jzip does the job exactly)
          try {
            const fileBuffer = await file.download(true) as Buffer;

            await ssh.exec(`mkdir -p ${destination}`);
            // @ts-ignore
            await sftp.writeFile(`${destination}/${name}`, fileBuffer, { encoding: 'binary' });
            this.logger.info(`Successfully written ${name} to server`);

            if (/\.(?:jpe?g|png)$/.test(name)) {
              await convert.writeWebpToServer(fileBuffer, { server: sftp, path: `${destination}/${name}` });
              this.logger.info(`Successfully written ${name}.webp to server`);

              let processedImage: Buffer;
              let fileName = name;
              const stripVariant = name
                .replace(/\.\w+$/, '')
                .replace(/^.+_/, '');

              if ([ 'a', 'd' ].includes(stripVariant))
                processedImage = await convert.rotate(fileBuffer);
              else {
                const delay = stripVariant === 'b'
                  ? 6
                  : [ 'c1', 'c2' ].includes(stripVariant)
                    ? 4
                    : 9;
                processedImage = await convert.animate(fileBuffer, { delay });
                processedImage = await convert.optimiseAnimation(processedImage);
                fileName = name.replace(/\.\w+$/, '.gif');
              }

              zip.file(fileName, processedImage, { binary: true, unixPermissions: '664' });
            }

            current++;
          } catch (f) {
              this.error = true;
              this.logger.error(`[${id}]\n  [${url}]\n  ${f.stack}`);
          }

          filenames.push(name);
        }

        try {
          const filenamesPath = `${this.base.DESTINATION.EPISODES}${id}/${resourceDirectory}/`;

          await ssh.exec(`mkdir -p ${filenamesPath}`);
          // @ts-ignore
          await sftp.writeFile(filenamesPath + 'files.rsc', filenames.join(','));
          this.logger.info('Successfully written files.rsc to server');

          if (Object.keys(zip.files).length) {
            const zipBuffer = await zip.generateAsync({
              type: 'nodebuffer',
              comment: 'Generated by kh-snek <https://kamihimedb.win>',
              compression: 'DEFLATE',
              compressionOptions: { level: 6 }
            });
            const zipName = `${characterName}_${resourceDirectory}.zip`;
            const zipPath = `${this.base.DESTINATION.MISC}${id}/`;

            await ssh.exec(`mkdir -p ${zipPath}`);
            // @ts-ignore
            await sftp.writeFile(zipPath + zipName, zipBuffer);
            this.logger.info(`Successfully written ${zipName} to server`);
          } else
            this.logger.warn(`Ignored Zip operation: found empty (${resourceDirectory})`);

          const resources = Object.entries(this.resources[id]) as Array<[string, string]>;
          const [ rKey, rVal ] = resources.find(e => e[1] === resourceDirectory);

          await this.db('kamihime').update({ [rKey]: rVal }).where('id', id);
          this.logger.info(`Successfully saved ${rKey}=${rVal} to DB`);
        } catch (err) {
          this.error = true;
          this.logger.error(`[${id}] [${resourceDirectory}]\n ${err.stack}`);
        }
      }

      this.logger.info(`Finished downloading resource assets for ${id}`);
    }

    return true;
  }

  private async _extract (id: string, resources: string[]) {
    let extracted = resources.length;

    for (const resource of resources) {
      this.logger.debug(`Extracting ${id} resource script ${resource}...`);

      const file = [ 0, 1, 3 ].includes(resources.indexOf(resource))
        ? '/scenario/first.ks'
        : '/scenario.json';
      const resourceLastFour = resource.slice(-4).split('');

      resourceLastFour.splice(2, 0, '/');
      const folder = resourceLastFour.join('') + '/';

      try {
        const data = await fetch(this.base.URL.SCENARIOS + folder + resource + file, { headers });
        const script = await data.text();

        if (!data.ok || !script) {
          this.logger.warn(
            `Failed to download ${file} for ${resource} (${this.base.URL.SCENARIOS + folder + resource + file})`
          );

          throw new Error(data.status + `: ${data.statusText}`);
        }

        if (file === '/scenario/first.ks')
          await this._doStory({
            id,
            resource,
            script,
            folder
          });
        else {
          const mainData = script
            .replace(/(.*?),\s*(\}|])/g, '$1$2')
            .replace(/;\s*?$/, '')
            .replace(/"words":"(.+)"/g, (_, p1: string) => `"words":"${p1.replace(/[“”]/g, '\\"')}"`)
            .replace(/(?<!\\)”/g, '"');
          const json: IScenarioSequence[] = JSON.parse(mainData);

          await this._doScenario({
            id,
            resource,
            script: json,
            folder
          });
        }

        this.logger.info(`Extracted ${id} resource script ${resource}`);
      } catch (err) {
        extracted--;
        this.error = true;
        this.logger.error(`[${id}] [${resource}]\n ${err.stack}`);
      }
    }

    return extracted;
  }

  private async _doStory (
    { id, resource, script, folder }:
    { id: string, resource: string, script: string, folder: string }
  ) {
    const chara = {};
    let lines = [];
    let name: string;

    const entries = script
      .replace(/\]\[/, ']\n[')
      .split('\n');

    for (const entry of entries) {
      const miscChar = [ '*', '#', 'Tap to continue' ].some(i => entry.startsWith(i));

      if (miscChar) continue;
      if (entry.startsWith('[')) {
        const attributes = entry
          .replace(/[[\]"]/g, '')
          .split(' ');

        if (attributes.length < 2) continue;

        const attribute: any = { command: attributes.shift() };

        for (const field of attributes) {
          const parsedField = field.split('=');
          const [ command, value ] = parsedField;

          if (parsedField.length === 2) attribute[command] = value;
        }

        switch (attribute.command) {
          case 'chara_new': {
            this.miscFiles.push(this.base.URL.FG_IMAGE + attribute.storage);
            Object.assign(chara, { [attribute.name]: { name: attribute.jname, storage: attribute.storage } });
            break;
          }

          case 'chara_face': {
            const url = this.base.URL.FG_IMAGE + attribute.storage;

            if (!this.miscFiles.includes(url))
              this.miscFiles.push(url);
            if (!chara[attribute.name].face)
              Object.assign(chara[attribute.name], { face: {} });

            Object.assign(chara[attribute.name].face, { [attribute.face]: attribute.storage });
            break;
          }

          case 'playbgm': {
            this.miscFiles.push(this.base.URL.BGM + attribute.storage);
            lines.push({ bgm: attribute.storage });
            break;
          }

          case 'bg': {
            const irrBG = [ 'white', 'black', 'tomei' ].some(i => attribute.storage && attribute.storage.startsWith(i));

            if (irrBG) continue;

            this.miscFiles.push(this.base.URL.BG_IMAGE + attribute.storage);
            lines.push({ bg: attribute.storage });
            break;
          }

          case 'chara_show': {
            name = chara[attribute.name] ? chara[attribute.name].name : '';

            lines.push({ expression: chara[attribute.name] ? chara[attribute.name].storage : '' });
            break;
          }

          case 'chara_mod': {
            lines.push({ expression: chara[attribute.name] ? chara[attribute.name].face[attribute.face] : '' });
            break;
          }

          case 'playse': {
            const isGetIntro = [ 'h_get', 'h_intro' ].some(i => attribute.storage && attribute.storage.startsWith(i));

            if (!isGetIntro) continue;

            this.files[id].resources[resource].push(
              `${this.base.URL.SCENARIOS}${folder}${resource}/sound/${attribute.storage}`
            );
            lines.push({ voice: attribute.storage });
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
          .replace(/&nbsp;?/gi, ' ');
        const invalidTalk = (text.replace(/ /g, '')).length < 2;

        if (invalidTalk) continue;

        lines.push({ chara: name ? name.replace(/&nbsp;?/gi, ' ') : name, words: text });
      }
    }

    const tmp = lines;
    let sequence: any = {};
    let lastBG = null;
    let lastBGM = null;
    lines = [];

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
        sequence.chara = sequence.chara.replace(/[ ]/g, ' ');

        lines.push(sequence);

        sequence = {};
      }
    }

    const scriptPath = `${this.base.DESTINATION.EPISODES}${id}/${resource}/`;

    await ssh.exec(`mkdir -p ${scriptPath}`);
    // @ts-ignore
    await sftp.writeFile(scriptPath + 'script.json', JSON.stringify({ scenario: lines }));

    return true;
  }

  private async _doScenario (
    { id, resource, script, folder }:
    { id: string, resource: string, script: IScenarioSequence[], folder: string }
  ) {
    const lines = [];

    for (const entry of script) {
      const entryData = {};

      if (entry.bgm) {
        this.miscFiles.push(`${this.base.URL.SCENARIOS}${folder}${resource}/${entry.bgm}`);

        Object.assign(entryData, { bgm: entry.bgm });
      }

      if (entry.film) {
        const url = `${this.base.URL.SCENARIOS}${folder}${resource}/${entry.film}`;

        if (![ 'black.jpg', 'pink_s.jpg' ].includes(entry.film))
          this.files[id].resources[resource].push(url);

        const fps = Number(entry.fps);

        Object.assign(entryData, {
          seconds: fps === 1 || fps === 16 ? 1 : fps === 24 ? '0.67' : 2,
          sequence: entry.film,
          steps: fps === 1 ? 1 : 16
        });
      }

      const talkData = [];

      for (const line of entry.talk) {
        const talkEntry = {};

        if (line.hasOwnProperty('voice')) {
          this.files[id].resources[resource].push(`${this.base.URL.SCENARIOS}${folder}${resource}/${line.voice}`);

          if (line.voice.length)
            Object.assign(talkEntry, { voice: line.voice });
        }

        line.words = line.words
          ? line.words
            .replace(/[[\]"]/g, '')
            .replace(/(\.{1,3}|…|,)(?=[^\s\W])/g, '$& ')
          : ' ';
        line.chara = line.chara
          ? line.chara
            .replace(/(["%])/g, '\\$&')
          : ' ';

        Object.assign(talkEntry, { chara: line.chara, words: line.words });

        const dataMax = script.length - 1;
        const lineMax = entry.talk.length - 1;

        if (script.indexOf(entry) === dataMax && entry.talk.indexOf(line) === lineMax)
          Object.assign(talkEntry, { toIndex: true });

        talkData.push(talkEntry);
      }

      Object.assign(entryData, { talk: talkData });

      lines.push(entryData);
    }

    const scriptPath = `${this.base.DESTINATION.EPISODES}${id}/${resource}/`;

    await ssh.exec(`mkdir -p ${scriptPath}`);
    // @ts-ignore
    await sftp.writeFile(scriptPath + 'script.json', JSON.stringify({ scenario: lines }));

    return true;
  }
}
