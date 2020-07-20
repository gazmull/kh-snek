import { Logger } from 'winston';
import SSH2Promise from 'ssh2-promise';
import SFTP from 'ssh2-promise/dist/sftp';
import Collection from '@discordjs/collection';

export interface IExtractorOptions {
  logger: Logger;
  session: string;
  base: {
    characters: ICharacter[];
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
