import Collection from 'collection';
import * as OS from 'os';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { downloadManagerData, hashIdentifier, ICharacter, IResourceValues, truncatedDownload } from '../../../typings';

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
    const workersResult: Array<string | Error> = [];

    if (typeof this.data[0] === 'string') {
      const balancedData = this._balanceData(this.data as string[]);
      const workers = await Promise.all(balancedData.map((val, idx) => this._spawnWorker(idx, val)));

      workersResult.push(...workers);
    } else
      for (const char of this.data as ICharacter[]) {
        const resources = [ ...char.resources.entries() ];
        const balancedData = this._balanceData<[hashIdentifier, IResourceValues]>(resources);
        const workers = await Promise.all(
          balancedData.map((val, idx) => {
            const finalData: ICharacter = {
              id: char.id,
              name: char.name,
              resources: new Collection(val)
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

  private _balanceData <T> (data: T[]) {
    const cpus = OS.cpus();
    const balancedData = Array.from<unknown, T[]>({ length: cpus.length }, () => []);
    const lastIndex = cpus.length - 1;
    let lastFilled = 0;

    for (const datum of data) {
      if (lastFilled > lastIndex) lastFilled = 0;

      balancedData[lastFilled].push(datum);
      lastFilled++;
    }

    return balancedData.filter(e => e.length);
  }
}