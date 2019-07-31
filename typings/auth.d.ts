/**
 * @property address The machine's external IP Address
 * @property port The port where the server is listening
 */
export interface Host {
  address: string;
  port?: number;
}

/**
 * @property gist The Github Gist ID.
 * @property token The Github user's personal access token.
 */
export interface Github {
  gist: string;
  token: string;
}

/**
 * @property session The user's Session value.
 * @property xsrf The user's XSRF Token value.
 */
export type KamihimeGrant = {
  session: string;
  xsrf: string;
}
