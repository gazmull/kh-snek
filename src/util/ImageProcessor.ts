import * as gm from 'gm';
import SFTP from 'ssh2-promise/dist/sftp';

const im = gm.subClass({ imageMagick: true });

export default class ImageProcessor {
  public async writeWebpToServer (buffer: Buffer, options: { server: SFTP, path: string }) {
    const img = im(buffer)
      .quality(70)
      .define('webp:method=6')
      .setFormat('webp');
    const webpBuffer = await this.toBuffer(img);

    // @ts-ignore
    return options.server.writeFile(options.path + '.webp', webpBuffer, { encoding: 'binary' });
  }

  public toBuffer (img: gm.State): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      img.toBuffer((err, buffer) => {
        if (err)
          return reject(err);

        return resolve(buffer);
      });
    });
  }

  public async rotate (buffer: Buffer) {
    const img = im(buffer)
      .out('-rotate', '-90<');

    return this.toBuffer(img);
  }

  public async animate (buffer: Buffer, options: IAnimateOptions) {
    const img = im(buffer)
      .in('-delay', String(options.delay))
      .out('-rotate', '-90<')
      .out('-crop', '900x640')
      .out('+adjoin')
      .out('+repage')
      .out('-adjoin')
      .setFormat('gif')
      .out('-loop', '0');

    return this.toBuffer(img);
  }

  public async optimiseAnimation (buffer: Buffer) {
    const img = im(buffer)
      .out('-fuzz', '5%')
      .out('-layers', 'Optimize');

    return this.toBuffer(img);
  }
}

export interface IAnimateOptions {
  delay: number;
}
