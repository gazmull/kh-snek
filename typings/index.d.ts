import { Logger } from 'winston';
import { KamihimeGrant } from './auth';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/lib/sftp';
import Collection from '@discordjs/collection';
import Knex from 'knex';

export interface IExtractorOptions {
  logger: Logger;
  grant: KamihimeGrant;
  flags: {
    digMode: boolean;
    forced: boolean;
    genericsOnly: boolean;
    noHentai: boolean;
    noMP3: boolean;
    noWEBP: boolean;
    sceneInfoOnly: boolean;
  }
  base: {
    characters: ICharacter[];
    BLOWFISH_KEY: string;
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
  db: Knex;
}

export type downloadManagerData = (string | ICharacter)[];

export type hashIdentifier = 'harem1Resource1' | 'harem2Resource1' | 'harem2Resource2' | 'harem3Resource1' | 'harem3Resource2';

export interface IResourceValues {
  hash: string;
  urls: string[];
}

export interface ICharacter {
  id?: string;
  name?: string;
  rarity?: string;
  resources: Collection<hashIdentifier, IResourceValues>;
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
