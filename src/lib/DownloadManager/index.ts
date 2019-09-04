import Collection from 'collection';
import * as OS from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { downloadManagerData, ICharacter, truncatedDownload } from '../../../typings';

export default class DownloadManager {

  constructor (data: downloadManagerData) {
    this.data = data;
  }

  public data: downloadManagerData;

  /**
   * Would you like to drink these pair of jars of mine?
   */
  public araAra () {
    return this.exec();
  }

  /**
   * ### The actual method
   * ---
   * How Workers will work:
   * 1. Create an SSH+SFTP session
   * 2. Download files from URL[] / Scene[] passed by parent (This module)
   * 3. Once file buffer received, process it with ImageProcessor
   * 4. Once finished with ImageProcessor, send the file
   * 5. process.exit(0).
   *
   * - In case of error, worker will send a message to parent
   */
  public async exec () {
    const cpus = OS.cpus();
    const workersResult: Array<string | Error> = [];

    if (typeof this.data[0] === 'string') {
      const sliceLength = Math.ceil(this.data.length / cpus.length);
      const workers = await Promise.all(
        cpus.map((_, idx) => {
          const data = this.data.splice(0, sliceLength);

          if (!data.length) return Promise.resolve('Worker spawn skipped');

          return this._spawnWorker(idx, data as string[]);
        })
      );

      workersResult.push(...workers);
    } else
      for (const char of this.data as ICharacter[]) {
        const resources = [ ...char.resources.entries() ];
        const sliceLength = Math.ceil(resources.length / cpus.length);
        const workers = await Promise.all(
          cpus.map((_, idx) => {
            const data = resources.splice(0, sliceLength);

            if (!data.length) return Promise.resolve('Worker spawn skipped');

            const finalData: ICharacter = {
              id: char.id,
              name: char.name,
              resources: new Collection(data)
            };

            return this._spawnWorker(idx, finalData);
          })
        );

        workersResult.push(...workers);
      }

    return workersResult;
  }

  private _spawnWorker (id: number, downloads: truncatedDownload): Promise<string | Error> {
    return new Promise(resolve => {
      const workerData = { id, downloads };
      const worker = new Worker(path.join(__dirname, 'worker.js'), { workerData });
      let errored = false;

      worker
        .once('message', () => errored = true)
        .once('exit', code => {
          if (code)
            return resolve(new Error(`[worker-${id}] exited as ${code}`));

          resolve(`[worker-${id}] exited ${errored ? 'with error(s)' : 'nicely'}.`);
        });
    });
  }
}
