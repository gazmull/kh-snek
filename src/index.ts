import Winston from '@gazmull/logger';
import Collection from 'collection';
import { prompt } from 'inquirer';
import Knex from 'knex';
import { Config as Database } from 'knex';
import { ICharacter } from '../typings';
import { Directories, KamihimeGrant } from '../typings/auth';
import Extractor from './lib/Extractor';
import { parseArg } from './lib/Util';

// tslint:disable-next-line:no-var-requires
const { database, destinations }: { database: Database, destinations: Directories } = require('../auth');
const grant: KamihimeGrant = {
  xsrf: '',
  session: ''
};

let code = 0;
const logger = new Winston('snek').logger;

start();

export default async function start () {
  try {
    logger.warn('kh-snek started...');

    const answers = await prompt([
      {
        name: 'xsrf',
        message: 'XSRF Token',
        validate: input => {
          if (!input)
            return 'You cannot skip this. Try again';

          return true;
        }
      },
      {
        name: 'session',
        message: 'Session Token',
        validate: input => {
          if (!input)
            return 'You cannot skip this. Try again';

          return true;
        }
      },
    ]);

    grant.xsrf = answers.xsrf;
    grant.session = answers.session;

    logger.warn('You are about to get yeeted. Goodluck!');

    let query = Knex(database)('kamihime').select([ 'id', 'name', 'rarity' ])
      .where('approved', 1);

    const genericsOnly = parseArg([ '-g', '--generics' ]);
    const forcedDownload = parseArg([ '-f', '--force' ]);

    if (!genericsOnly && !forcedDownload)
      query = query.andWhere('harem1Resource1', null);

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

      query = query.andWhere('id', val);
    }

    if (type) {
      const _type = type.slice(2);

      switch (_type) {
        case 'eidolon': query = query.andWhereRaw('id LIKE \'e%\''); break;
        case 'soul': query = query.andWhereRaw('id LIKE \'s%\''); break;
        case 'ssr+':
        case 'ssr':
        case 'sr':
        case 'r':
          query = query.andWhereRaw(`id LIKE 'k%' AND rarity='${_type.toUpperCase()}'`);
          break;
      }
    }

    let characters: ICharacter[] = await query;

    if (!characters.length) throw new Error('Nothing to be processed.');

    characters = characters.map(char => ({ ...char, resources: new Collection() }));
    const SCENARIOS = 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/';

    await new Extractor({
      logger,
      grant,
      base: {
        characters,
        DESTINATION: {
          EPISODES: destinations.scenarios,
          MISC: destinations.zips
        },
        URL: {
          FG_IMAGE: SCENARIOS + 'fgimage/',
          BG_IMAGE: SCENARIOS + 'bgimage/',
          BGM: SCENARIOS + 'bgm/',
          SCENARIOS,
          EPISODES: 'https://cf.r.kamihimeproject.dmmgames.com/v1/episodes/',
          SOULS: {
            INFO: 'https://cf.r.kamihimeproject.dmmgames.com/v1/a_jobs/'
          },
          EIDOLONS: {
            SCENES: 'https://cf.r.kamihimeproject.dmmgames.com/v1/gacha/harem_episodes/summons/'
          },
          KAMIHIMES: {
            SCENES: 'https://cf.r.kamihimeproject.dmmgames.com/v1/gacha/harem_episodes/characters/'
          }
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
