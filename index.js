const Extractor = require('./utils/Extractor');
const { directory: dir } = require('./auth');
const path = require('path');

const destination = dir ? `${path.resolve(dir)}/` : `${process.cwd()}/static/scenarios/`;
const scripts = `${destination}scripts/`;
const url = {
  fgImage: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/fgimage/',
  bgImage: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/bgimage/',
  bgm: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/bgm/',
  scenarios: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/'
};
const codes = {
  kamihime: {
    intro: '94/76/',
    scene: 'de/59/',
    get: '76/89/'
  },
  eidolon: {
    intro: '9f/51/',
    scene: 'd7/ad/',
    get: '9f/51/'
  },
  soul: {
    intro: '67/01/',
    scene: 'ec/4d/',
    get: '3b/26/'
  }
};

async function start() {
  try {
    await new Extractor({
      base: {
        url,
        destination,
        scripts
      },
      codes
    })
      .execute();
  } catch (f) {
    console.log(f.stack);
  }
}

start();
