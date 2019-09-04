import Winston from '@gazmull/logger';
import Zip from 'jszip';
import Knex from 'knex';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/dist/sftp'; // Need to fork this to update wrong types
import { parentPort } from 'worker_threads';
import { Auth } from '../../../typings/auth';
import { ICharacter, truncatedDownload } from '../../../typings/index';
import Downloader from '../Downloader';
import ImageProcessor from '../ImageProcessor';

// tslint:disable:no-var-requires

const { workerData }:
  { workerData: { id: number, downloads: truncatedDownload } } = require('worker_threads');
const auth: Auth = require('../../../auth');
const ssh = new SSH2Promise(auth.ssh);
let sftp: SFTP;
const convert = new ImageProcessor();
const logger = new Winston(`worker.${workerData.id}`).logger;
const log = {
  info: (msg: string) => logger.info(`[worker-${workerData.id}]: ${msg}`),
  warn: (msg: string) => logger.warn(`[worker-${workerData.id}]: ${msg}`),
  error: (msg: string) => logger.error(`[worker-${workerData.id}]: ${msg}`)
};

// tslint:enable:no-var-requires

async function start (data: truncatedDownload) {
  try {
    log.info('connecting to remote server...');
    await ssh.connect();
    sftp = ssh.sftp();

    log.info('connected to remote server');

    if (typeof data[0] === 'string') await doGenerics(data as string[]);
    else await doSpecifics(data as ICharacter);

    ssh.close();
  } catch (err) { throw new Error(err); }
}

async function doGenerics (urls: string[]) {
  let current = 1;
  const dirName = `${auth.destinations.scenarios}misc/`;
  const existingFiles = (await sftp.readdir(dirName).catch(() => []) as Array<{ filename: string }>)
    .filter(e => e && e.filename && !e.filename.endsWith('.webp'));

  if (existingFiles.length)
    urls = urls.filter(e => !existingFiles.find(m => m.filename === e.split('/').pop()));

  for (const url of urls) {
    const name = url.split('/').pop();
    const file = new Downloader({ url });

    log.info(`Downloading Story generics... [${current} / ${urls.length}]`);

    try {
      const fileBuffer = await file.download(true) as Buffer;
      const filePath = `${dirName}${name}`;

      await ssh.exec(`mkdir -p ${dirName}`);
      // @ts-ignore
      await sftp.writeFile(filePath, fileBuffer, 'binary');
      log.info(`Written ${name} to server`);

      if (/\.(?:jpe?g|png)$/.test(name)) {
        const webpBuffer = await convert.toWebpBuffer(fileBuffer);

        // @ts-ignore
        await sftp.writeFile(`${filePath}.webp`, webpBuffer, 'binary');
        log.info(`Written ${name}.webp to server`);
      }

      current++;
    } catch (f) {
      parentPort.postMessage('errored');
      log.error(`[GENERICS]\n  [${url}]\n  ${f.stack || f}`);
    }
  }

  return true;
}

async function doSpecifics (char: ICharacter) {
  log.info(`Downloading Specific assets for ${char.id}...`);

  for (const resource of char.resources) {
    const [ key, { urls, hash } ] = resource;
    const fileNames: string[] = [];
    const zip = new Zip();
    let current = 1;

    log.info(`Downloading ${key} Specific assets...`);

    for (const url of urls) {
      const destination = `${auth.destinations.scenarios}${char.id}/${hash}/`;
      const name = url.split('/').pop();
      const file = new Downloader({ url });
      const filePath = `${destination}${name}`;

      log.info(`Downloading Specific assets ${char.id}... [${current} / ${urls.length}]`);

      try {
        const fileBuffer = await file.download(true) as Buffer;

        await ssh.exec(`mkdir -p ${destination}`);
        // @ts-ignore
        await sftp.writeFile(filePath, fileBuffer, 'binary');
        log.info(`Written ${name} to server`);

        if (/\.(?:jpe?g|png)$/.test(name)) {
          const webpBuffer = await convert.toWebpBuffer(fileBuffer);

          // @ts-ignore
          await sftp.writeFile(`${filePath}.webp`, webpBuffer, 'binary');
          log.info(`Written ${name}.webp to server`);

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
                : 12;
            processedImage = await convert.animate(fileBuffer, { delay });
            processedImage = await convert.optimiseAnimation(processedImage);
            fileName = name.replace(/\.\w+$/, '.gif');
          }

          zip.file(fileName, processedImage, { binary: true, unixPermissions: '664' });
        }

        current++;
      } catch (f) {
        parentPort.postMessage('errored');
        log.error(`[${char.id}]\n  [${url}]\n  ${f.stack || f}`);
      }

      fileNames.push(name);
    }

    try {
      const fileNamesPath = `${auth.destinations.scenarios}${char.id}/${key}/`;

      await ssh.exec(`mkdir -p ${fileNamesPath}`);
      // @ts-ignore
      await sftp.writeFile(`${fileNamesPath}files.rsc`, fileNames.join(','));
      log.info(`Written ${key}'s files.rsc to server`);

      if (Object.keys(zip.files).length) {
        const zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          comment: 'Generated by kh-snek <https://github.com/gazmull/kh-snek>',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        const zipName = `${char.name}_${hash}.zip`;
        const zipPath = `${auth.destinations.zips}${char.id}/`;

        await ssh.exec(`mkdir -p ${zipPath}`);
        // @ts-ignore
        await sftp.writeFile(`${zipPath}${zipName}`, zipBuffer);
        log.info(`Written ${zipName} to server`);
      } else
        log.warn(`Ignored Zip operation: not h_anime (${char.id}'s ${key})`);

      await Knex(auth.database)('kamihime').update({ [key]: hash }).where('id', char.id);
      log.info(`Saved ${char.id}'s ${key} hash to DB`); // test this
    } catch (f) {
      parentPort.postMessage('errored');
      log.error(`[${char.id}] [${key}]\n ${f.stack || f}`);
    }
  }

  return true;
}

start(workerData.downloads)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
