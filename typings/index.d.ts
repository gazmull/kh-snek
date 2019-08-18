import * as Knex from 'knex';
import { Logger } from 'winston';
import { KamihimeGrant } from './auth';

export interface IExtractorOptions {
  logger: Logger;
  grant: KamihimeGrant;
  db: Knex;
  base: {
    characters: IKamihime[];
    DESTINATION: {
      MISC: string;
      EPISODES: string;
    };
    URL: {
      SCENARIOS: string;
      FG_IMAGE: string;
      BG_IMAGE: string;
      BGM: string;
      EPISODES: string;
      KAMIHIMES: {
        SCENES: string;
      };
      EIDOLONS: {
        SCENES: string;
      };
      SOULS: {
        INFO: string;
      }
    };
  };
}

export interface IExtractorFiles {
  [key: string]: {
    name: string;
    resources: {
      [key: string]: string[];
    }
  };
}

export interface IScenarioSequence {
  auto?: boolean;
  bgm: string;
  film: string;
  fps?: number;
  talk: Array<{
    chara: string;
    voice: string;
    words: string;
  }>;
}

export interface IKamihime {
  harem1Resource1?: string;
  harem2Resource1?: string;
  harem2Resource2?: string;
  harem3Resource1?: string;
  harem3Resource2?: string;
  id?: string;
  name?: string;
  rarity?: string;
}
