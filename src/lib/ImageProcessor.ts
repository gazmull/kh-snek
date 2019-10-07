import * as gm from 'gm';

const im = gm.subClass({ imageMagick: true });

export default class ImageProcessor {
  public static async toWebpBuffer (buffer: Buffer) {
    const img = im(buffer)
      .quality(70)
      .define('webp:method=6')
      .setFormat('webp');

    return this.toBuffer(img);
  }

  public static toBuffer (img: gm.State): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      img.toBuffer((err, buffer) => {
        if (err)
          return reject(err);

        return resolve(buffer);
      });
    });
  }

  public static async rotate (buffer: Buffer) {
    const img = im(buffer)
      .out('-rotate', '-90<');

    return this.toBuffer(img);
  }

  public static async animate (buffer: Buffer, options: IAnimateOptions) {
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

  public static async optimiseAnimation (buffer: Buffer) {
    const img = im(buffer)
      .out('-fuzz', '3%')
      .out('-layers', 'OptimizeTransparency');

    return this.toBuffer(img);
  }
}

export interface IAnimateOptions {
  delay: number;
}
