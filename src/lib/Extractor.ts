import * as Knex from 'knex';
import fetch from 'node-fetch';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/dist/sftp'; // Need to fork this to update wrong types
import { Logger } from 'winston';
import { IExtractorOptions, IScenarioSequence } from '../../typings';
import Downloader from './Downloader';
import DownloadManager from './DownloadManager';
import GithubGist from './GithubGist';

// tslint:disable-next-line:no-var-requires
const ssh = new SSH2Promise(require('../../auth').ssh);
let sftp: SFTP;

const headers = {
  'User-Agent': Downloader.headers['user-agent'],
  Cookie: ''
};

export default class Extractor {
  constructor (options: IExtractorOptions) {
    this.base = options.base;

    this.logger = options.logger;

    this.miscFiles = [];

    this.blacklist = [];

    this.resourcesExtracted = 0;

    this.resourcesFound = 0;

    this.filesFound = 0;

    this.error = false;

    headers.Cookie = `XSRF-TOKEN=${options.grant.xsrf};session=${options.grant.session}`;
  }

  public base: IExtractorOptions['base'];
  public db: Knex;
  public miscFiles: string[];
  public blacklist: string[];
  public resourcesExtracted: number;
  public resourcesFound: number;
  public filesFound: number;
  public error: boolean;
  public logger: Logger;
  public verbose: boolean;

  public files (id: string, hash: string) {
    return this.base.characters.find(e => e.id === id).resources.find(e => e.hash === hash);
  }

  public async exec () {
    try {
      this.logger.info('Connecting to remote server via SSH...');
      await ssh.connect();
      sftp = ssh.sftp();

      this.logger.info('Connected to remote server via SSH.');
    } catch (err) { throw new Error(err); }

    for (const character of this.base.characters) {
      const { id } = character;

      this.logger.info(`Obtaining episodes for ${id}...`);

      const resources = await this._getEpisodes(id);
      this.resourcesFound += resources.length;
      this.resourcesExtracted += await this._extract(id, resources);
    }

    ssh.close();
    this.logger.info('Closed SSH connection. (Not necessary anymore)');

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
    const result: {
      harem1Resource1?: string,
      harem2Resource1?: string,
      harem2Resource2?: string,
      harem3Resource1?: string,
      harem3Resource2?: string
    } = {};

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

    for (const [ k, v ] of Object.entries(result))
      this.base.characters.find(e => e.id === id).resources.set(k as any, { hash: v, urls: [] });

    return Object.values(result);
  }

  private async _download () {
    for (const arr of [ this.miscFiles, this.base.characters ])
      try {
        const managerKun = new DownloadManager(arr);
        const instances = await managerKun.araAra();

        for (const log of instances)
          this.logger.info(log instanceof Error ? log.stack : log);
      } catch (err) {
        this.error = true;
        this.logger.error(`${err.stack || err}`);
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
            if (!this.blacklist.includes(attribute.storage))
              this.miscFiles.push(this.base.URL.FG_IMAGE + attribute.storage);

            Object.assign(chara, { [attribute.name]: { name: attribute.jname, storage: attribute.storage } });
            break;
          }

          case 'chara_face': {
            const url = this.base.URL.FG_IMAGE + attribute.storage;
            const blacklisted = this.blacklist.includes(attribute.storage);

            if (!blacklisted && !this.miscFiles.includes(url))
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

            this.files(id, resource).urls.push(
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
          this.files(id, resource).urls.push(url);

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
          this.files(id, resource).urls.push(`${this.base.URL.SCENARIOS}${folder}${resource}/${line.voice}`);

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