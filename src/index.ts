import Collection from '@discordjs/collection';
import Winston from '@gazmull/logger';
import { prompt } from 'inquirer';
import Knex, { Config as Database } from 'knex';
import { ICharacter, IExtractorOptions } from '../typings';
import { Directories } from '../typings/auth';
import Extractor from './lib/Extractor';
import { parseArg } from './lib/Util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { database, destinations }: { database: Database, destinations: Directories } = require('../auth');

let code = 0;
const logger = new Winston('snek').logger;

start();

/** Starts the snek. */
export default async function start () {
  try {
    logger.warn('kh-snek started...');

    const boolFlags = (flags: string[]) => Boolean(parseArg(flags));
    const flags: IExtractorOptions['flags'] = {
      digMode: boolFlags([ '-d', '--dig' ]),
      forced: boolFlags([ '-f', '--force' ]),
      genericsOnly: boolFlags([ '-g', '--generics' ]),
      noHentai: boolFlags([ '--nohentai' ]),
      noMP3: boolFlags([ '--nomp3' ]),
      noWEBP: boolFlags([ '--nowebp' ]),
      sceneInfoOnly: boolFlags([ '--nodl' ])
    };

    let session;

    if (!flags.digMode) {
      const answers = await prompt([
        {
          name: 'session',
          message: 'Session Token',
          validate: (input: string) => {
            if (!input.trim())
              return 'You cannot skip this. Try again';

            return true;
          }
        },
      ]);

      session = answers.session;
    }

    logger.warn('You are about to get yeeted. Goodluck!');

    let query = Knex(database)('kamihime').select([ 'id', 'name', 'rarity' ]);

    const latest = parseArg([ '-l', '--latest=' ]);
    const id = parseArg([ '-i', '--id=' ]);
    const type = parseArg(
      [
        '--eidolon',
        '--soul',
        '--ssr+', '--ssr', '--sr', '--r',
      ]
    );

    if (latest && id) throw new Error('Latest and ID cannot be invoked at the same time.');
    if (id && type) throw new Error('ID and Type cannot be invoked at the same time.');

    if (latest) {
      const detectNum = /--latest=/.test(latest) ? latest.split('=').pop() : latest.slice(2);
      const num = parseInt(detectNum);

      if (isNaN(num) || num <= 0)
        throw new TypeError('Latest value should be a valid unsigned integer and more than 0.');

      query = query
        .orderBy('_rowId', 'DESC')
        .limit(num);
    } else if (id) {
      const val = /--id=/.test(id) ? id.split('=').pop() : id.slice(2);

      if (!val)
        throw new Error('ID value should be not empty.');

      query = query.whereIn('id', val.split('-'));
    }

    if (type) {
      const _type = type.slice(2);
      const whereClause = id ? 'andWhereRaw' : 'whereRaw';

      switch (_type) {
        case 'eidolon': query = query[whereClause]('id LIKE \'e%\''); break;
        case 'soul': query = query[whereClause]('id LIKE \'s%\''); break;
        case 'ssr+':
        case 'ssr':
        case 'sr':
        case 'r':
          query = query[whereClause](`id LIKE 'k%' AND rarity='${_type.toUpperCase()}'`);
          break;
      }
    }

    if (!flags.genericsOnly && !flags.forced)
      query = query[id || type ? 'andWhere' : 'where']('harem1Resource1', null);

    let characters: ICharacter[] = await query[id || type || (!flags.genericsOnly && !flags.forced)
      ? 'andWhere'
      : 'where']('approved', 1);

    if (!characters.length) throw new Error('Nothing to be processed.');

    characters = characters.map(char => ({ ...char, resources: new Collection() }));
    const SCENARIOS = 'http://static-r.kamihimeproject.net/scenarios/';

    await new Extractor({
      logger,
      session,
      flags,
      base: {
        characters,
        BLOWFISH_KEY: 'bLoWfIsH',
        DESTINATION: {
          EPISODES: destinations.scenarios,
          MISC: destinations.zips
        },
        URL: {
          FG_IMAGE: `${SCENARIOS}fgimage/`,
          BG_IMAGE: `${SCENARIOS}bgimage/`,
          BGM: `${SCENARIOS}bgm/`,
          SCENARIOS,
          EPISODES: 'https://r.kamihimeproject.net/v1/episodes/',
          SOULS: { INFO: 'https://r.kamihimeproject.net/v1/a_jobs/' },
          EIDOLONS: { SCENES: 'https://r.kamihimeproject.net/v1/gacha/harem_episodes/summons/' },
          KAMIHIMES: { SCENES: 'https://r.kamihimeproject.net/v1/gacha/harem_episodes/characters/' }
        }
      }
    }).exec();
  } catch (err) {
    logger.error(err.stack);

    code = 1;
  } finally {
    logger.info('kh-snek finished.');

    process.exit(code);
  }
}
