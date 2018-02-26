const { get } = require('snekfetch');
const Downloader = require('./utils/Downloader');

const { api } = require('./auth');

const kamihime = {
  intro: '94/76/',
  scene: 'de/59/',
  get: '76/89/'
};

const eidolon = {
  intro: '9f/51/',
  scene: 'd7/ad/',
  get: '9f/51/'
};

const soul = {
  intro: '67/01/',
  scene: 'ec/4d/',
  get: '3b/26/'
};

const sequences = ['a', 'b', 'c1', 'c2', 'c3', 'd'];

// link structure:
// https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/d7/ad/a1ef0e1bc4d7da47935eae9c20e388b806f12ba16f14d7ad/0037-2-2_d.jpg
const baseURL = { scenarios: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/' };
const baseDestination = `${__dirname}/static/scenarios/`;

const ouroboros = 'e0044';

function combine(array) {
  const result = [];
  for (const k in array)
    for (let v = 0; v < array[k].length; v++)
      result.push(array[k][v]);

  return result;
}

function characterCode(character) {
  let code;

  if (character.khID.startsWith('s'))
    code = soul.scene;
  else if (character.khID.startsWith('e'))
    code = eidolon.scene;
  else
    code = kamihime.scene;

  return code;
}

async function start() {
  try {
    const data = await get(`${api.url}list`);
    const list = combine(data.body);
    const isOuroboros = (id, r) => {
      if (id === ouroboros)
        return `${id.slice(1)}-${r + 1}-1`;

      return `${id.slice(1)}-${r + 1}-2`;
    };

    for (let i = 1; i < list.length; i++)
      for (let r = 1; r <= 2; r++) {
        const resource2 = list[i][`khHarem_hentai${r}Resource2`];
        if (!resource2) continue;

        for (const sequence of sequences) {
          const fileInfo = new Downloader({
            url: `${baseURL.scenarios}${characterCode(list[i])}${resource2}/${isOuroboros(list[i].khID, r)}_${sequence}.jpg`,
            destDirectory: `${baseDestination}${resource2}`,
            filename: `${isOuroboros(list[i].khID, r)}_${sequence}.jpg`
          });

          try {
            await fileInfo.download();
            console.log(`Downloaded successfully. -> ${isOuroboros(list[i].khID, r)}_${sequence}.jpg (${list[i].khName})`);
          } catch (f) {
            console.log(f.message, `-> ${isOuroboros(list[i].khID, r)}_${sequence}.jpg (${list[i].khName})`);
          }
        }
      }
  } catch (err) {
    console.log(err.stack);
  }
}

start();

process.on('unhandledRejection', err => console.log(err.stack));