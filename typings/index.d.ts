import * as Knex from 'knex';
import { Logger } from 'winston';
import { Host, KamihimeGrant } from './auth';

export interface IAuth {
  database: Knex.Config;
  exempt: string[];
  host: Host;
  rootURL: string;
}

export interface IExtractorOptions {
  logger: Logger;
  grant: KamihimeGrant;
  db: Knex;
  base: {
    CHARACTERS: IKamihime[];
    DESTINATION: string;
    URL: {
      SCENARIOS: string,
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
    [key: string]: string[],
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
  _rowId?: number;
  approved?: number;
  avatar?: string;
  element?: string;
  harem1Resource1?: string;
  harem1Title?: string;
  harem2Resource1?: string;
  harem2Resource2?: string;
  harem2Title?: string;
  harem3Resource1?: string;
  harem3Resource2?: string;
  harem3Title?: string;
  id?: string;
  loli?: number;
  main?: string;
  name?: string;
  peeks?: number;
  preview?: string;
  rarity?: string;
  tier?: string;
  type?: string;
  atk?: number;
  hp?: number;
  created?: string;
  updated?: string;
}
