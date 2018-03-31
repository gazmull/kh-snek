const Extractor = require('./utils/Extractor');
const { api: { url: apiURL }, directory: dir } = require('./auth');

const destination = dir || `${__dirname}/static/scenarios/`;
const scripts = `${destination}scripts/`;
const url = {
  api: apiURL,
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

new Extractor({
  base: {
    url,
    destination,
    scripts
  },
  codes
}).execute();
