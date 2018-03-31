const Downloader = require('./Downloader');

class Extractor {
  constructor(options) {
    /* eslint-disable global-require */

    this.get = require('snekfetch').get;

    this.readDirectory = require('fs').readdirSync;

    /* eslint-enable global-require */

    this.base = options.base;

    this.codes = options.codes;

    this.links = { '0000': { misc: [] } };

    this.filesDownloaded = 0;

    this.filesFound = 0;
  }

  async execute() {
    const { get, readDirectory, base, codes, links } = this;
    const characters = readDirectory(base.scripts);
    let { filesDownloaded, filesFound } = this;

    for (const character of characters) {
      const characterScripts = `${base.scripts}${character}/`;
      const scripts = readDirectory(characterScripts);
      const splitChar = character.split('_');
      const type = splitChar[0];
      let name = splitChar[1];
      let names = await get(`${base.url.api}search?name=${character.split('_').pop()}`);
      names = names.body;

      if (!names.length)
        continue;

      else if (names.length === 1)
        name = names.shift().khID;

      else
        for (const i of names)
          if (i.khName.toLowerCase() === name.toLowerCase())
            name = i.khID;

      links[name] = {};

      for (const script of scripts) {
        let data = require(`${characterScripts}${script}`); // eslint-disable-line global-require

        if (data.hasOwnProperty('scenario')) {
          const resourceDirectory = data.resource_directory;

          if (!links[name].hasOwnProperty(resourceDirectory))
            links[name][resourceDirectory] = [];

          data = data.scenario.split('\n');

          for (let entry of data) {
            const miscChar = ['*', '#', 'Tap to continue'].some(i => entry.startsWith(i));

            if (miscChar) continue;

            if (entry.startsWith('[')) {
              entry = entry.replace(/[[\]"]/g, '').split(' ');

              if (entry.length < 2) continue;

              const line = { command: entry[0] };

              for (let record of entry.slice(1)) {
                record = record.split('=');
                const command = record.shift();

                if (command.length === 2)
                  line.command = command;

                if (command.startsWith('storage'))
                  line.storage = record.shift();
              }

              const startsAs = {
                character: ['chara_new', 'chara_face'].some(i => line.command.startsWith(i)),
                bgm: line.command.startsWith('playbgm'),
                bg: line.command.startsWith('bg')
              };

              if (startsAs.character)
                links['0000'].misc.push(base.url.fgImage + line.storage);

              if (startsAs.bgm)
                links['0000'].misc.push(base.url.bgm + line.storage);

              if (startsAs.bg)
                links['0000'].misc.push(base.url.bgImage + line.storage);

              if (line.command.startsWith('playse')) {
                const isGetIntro = ['h_get', 'h_intro'].some(i => line.storage.startsWith(i));

                if (isGetIntro)
                  links[name][resourceDirectory].push(
                    `${base.url.scenarios}${codes[type].intro}${resourceDirectory}/sound/${line.storage}`
                  );
              }
            }
          }
        } else if (data.hasOwnProperty('scene_data')) {
          const resourceDirectory = data.resource_directory;

          if (!links[name].hasOwnProperty(resourceDirectory))
            links[name][resourceDirectory] = [];

          for (const entry of data.scene_data) {
            if (entry.hasOwnProperty('bgm'))
              links[name][resourceDirectory].push(
                `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${entry.bgm}`
              );

            if (entry.hasOwnProperty('film'))
              links[name][resourceDirectory].push(
                `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${entry.film}`
              );

            for (const line of entry.talk)
              if (line.hasOwnProperty('voice'))
                links[name][resourceDirectory].push(
                  `${base.url.scenarios}${codes[type].scene}${resourceDirectory}/${line.voice}`
                );
          }
        }
      }

      for (const chara in links)
        for (let resourceDirectory in links[chara]) {
          const resourceID = resourceDirectory;
          resourceDirectory = links[chara][resourceDirectory];
          filesFound += resourceDirectory.length;

          for (const url of resourceDirectory) {
            if (!url) continue;

            const fileInfo = new Downloader({
              url,
              destination: `${base.destination}${chara}/${resourceID}/`,
              name: url.split('/').pop()
            });

            try {
              const file = await fileInfo.download();

              console.log('Downloaded Successfully -> ', file);

              filesDownloaded++;
            } catch (f) {
              console.log('Error:', f.message, `-> ${chara} (${url})`);
            }
          }
        }
    }

    console.log(`Extracted ${Object.keys(links).length - 1} characters. (Expected: ${characters.length})`);
    console.log(`Downloaded ${filesDownloaded} files. (Expected: ${filesFound})`);
  }
}

module.exports = Extractor;
