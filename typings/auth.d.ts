import * as Knex from 'knex';

/**
 * @property gist The Github Gist ID.
 * @property token The Github user's personal access token.
 */
export interface Github {
  gist: string;
  token: string;
}

/**
 * Configuration for Kamihime PROJECT user's information.
 *
 * This is used for logging into the game to extract all episodes.
 * Please make sure to avoid using the game while doing this to avoid being blocked from the game.
 *
 * Get your credentials via `Site Information` -> `Cookies` -> Expand `gnkh-api-r.prod.nkh.dmmgames.com`
 * @property session The user's Session value.
 * @property xsrf The user's XSRF Token value.
 */
export type KamihimeGrant = {
  session: string;
  xsrf: string;
}

/**
 * Configuration for remote directories (Writing assets to your server).
 * @property scenarios Where to write the usual episode assets.
 * @property zips Where to write zipped animated episode scenario images.
 */
export type Directories = {
  scenarios: string;
  zips: string;
}

export interface Auth {
  database: Knex.Config;
  github: Github;
  ssh: {
    host: string;
    port: string;
    username: string;
    identity: string;
    passphrase?: string;
  };
  destinations: Directories;
}
