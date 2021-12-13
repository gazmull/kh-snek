// SSH2-Promise has wrong types so:
/* eslint-disable @typescript-eslint/ban-ts-comment */

import Winston from '@gazmull/logger';
import Zip from 'jszip';
import Knex from 'knex';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/lib/sftp';
import { parentPort } from 'worker_threads';
import Downloader from '..';
import { Auth } from '../../../../typings/auth';
import { downloadManagerData, ICharacter, IExtractorOptions } from '../../../../typings/index';
import ImageProcessor from '../../ImageProcessor';

/* eslint-disable @typescript-eslint/no-var-requires */

const { workerData }: {
  workerData: {
    id: number,
    downloads: downloadManagerData,
    flags: IExtractorOptions['flags']
  }
} = require('worker_threads');
const auth: Auth = require('../../../../auth');
const ssh = new SSH2Promise(auth.ssh);
let sftp: SFTP;
const logger = new Winston(`worker.${workerData.id}`, `[worker-${workerData.id}]`).logger;

/* eslint-enable @typescript-eslint/no-var-requires */

/** Intiailise download to remote server. */
async function start (data: downloadManagerData) {
  try {
    logger.info('connecting to remote server...');
    await ssh.connect();
    sftp = ssh.sftp();

    logger.info('connected to remote server');

    if (typeof data[0] === 'string') await doGenerics(data as string[]);
    else await doSpecifics(data as ICharacter[]);

    ssh.close();
  } catch (err) { throw new Error(err); }
}

/** Downloads story assets. */
async function doGenerics (urls: string[]) {
  let current = 1;
  const dirName = `${auth.destinations.scenarios}misc/`;

  if (!workerData.flags.forced) {
    const existingFiles = (await sftp.readdir(dirName).catch(() => []) as Array<{ filename: string }>)
      .filter(e => e && e.filename && !e.filename.endsWith('.webp'));

    if (existingFiles.length)
      urls = urls.filter(e => !existingFiles.find(m => m.filename === e.split('/').pop()));
    if (!urls.length) return true;
  }

  for (const url of urls) {
    const name = url.split('/').pop().trim();
    const file = new Downloader({ url });

    logger.info(`Downloading Story generics... [${current} / ${urls.length}]`);

    try {
      const fileBuffer = await file.download(true) as Buffer;
      const filePath = `${dirName}${name}`;

      await ssh.exec(`mkdir -p ${dirName}`);
      // @ts-ignore
      await sftp.writeFile(filePath, fileBuffer, 'binary');
      logger.info(`Written ${name} to server`);

      if (/\.(?:jpe?g|png)$/.test(name) && !workerData.flags.noWEBP) {
        const webpBuffer = await ImageProcessor.toWebpBuffer(fileBuffer);

        // @ts-ignore
        await sftp.writeFile(`${filePath}.webp`, webpBuffer, 'binary');
        logger.info(`Written ${name}.webp to server`);
      }

      current++;
    } catch (f) {
      parentPort.postMessage('errored');
      logger.error(`[GENERICS]\n  [${url}]\n  ${f.stack || f}`);
    }
  }

  return true;
}

/** Downloads scenario assets. */
async function doSpecifics (chars: ICharacter[]) {
  for (const char of chars) {
    logger.info(`Downloading Specific assets for ${char.id}...`);

    for (const resource of char.resources) {
      const [ key, { urls, hash } ] = resource;
      const zip = new Zip();
      let current = 1;

      logger.info(`Downloading ${key} Specific assets...`);

      for (const url of urls) {
        const destination = `${auth.destinations.scenarios}${char.id}/${hash}/`;
        let name = url.split('/').pop().trim();

        if (name.endsWith('h.jpg'))
          name = name.replace('_h.jpg', '.jpg');

        const file = new Downloader({ url });
        const filePath = `${destination}${name}`;

        logger.info(`Downloading Specific assets ${char.id}... [${current} / ${urls.length}]`);

        try {
          const fileBuffer = await file.download(true) as Buffer;

          await ssh.exec(`mkdir -p ${destination}`);
          // @ts-ignore
          await sftp.writeFile(filePath, fileBuffer, 'binary');
          logger.info(`Written ${name} to server`);

          if (/\.(?:jpe?g|png)$/.test(name)) {
            if (!workerData.flags.noWEBP) {
              const webpBuffer = await ImageProcessor.toWebpBuffer(fileBuffer);

              // @ts-ignore
              await sftp.writeFile(`${filePath}.webp`, webpBuffer, 'binary');
              logger.info(`Written ${name}.webp to server`);
            }

            let processedImage: Buffer;
            let fileName = name;
            const stripVariant = name
              .replace(/\.\w+$/, '')
              .replace(/^.+_/, '');

            if ([ 'a', 'd' ].includes(stripVariant))
              processedImage = await ImageProcessor.rotate(fileBuffer);
            else {
              const delay = stripVariant === 'b'
                ? 6
                : [ 'c1', 'c2' ].includes(stripVariant)
                  ? 4
                  : 12;
              processedImage = await ImageProcessor.animate(fileBuffer, { delay });
              processedImage = await ImageProcessor.optimiseAnimation(processedImage);
              fileName = name.replace(/\.\w+$/, '.gif');
            }

            zip.file(fileName, processedImage, { binary: true, unixPermissions: '664' });
          }

          current++;
        } catch (f) {
          parentPort.postMessage('errored');
          logger.error(`[${char.id}]\n  [${url}]\n  ${f.stack || f}`);
        }
      }

      try {
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
          logger.info(`Written ${zipName} to server`);
        } else
          logger.warn(`Ignored Zip operation: not h_anime (${char.id}'s ${key})`);

        await Knex(auth.database)('kamihime').update({ [key]: hash }).where('id', char.id);
        logger.info(`Saved ${char.id}'s ${key} hash to DB`);
      } catch (f) {
        parentPort.postMessage('errored');
        logger.error(`[${char.id}] [${key}]\n ${f.stack || f}`);
      }
    }
  }

  return true;
}

start(workerData.downloads)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
