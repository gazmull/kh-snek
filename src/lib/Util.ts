import { Github as gh } from '../../typings/auth';
import fetch from 'node-fetch';

/** Returns the first argument found in `process.argv`..
 * @param args - The arguments to look in `process.argv`.
 */
export function parseArg (args: string[]) {
  return process.argv.find(el => args.some(f => new RegExp(`^${f}`, 'i').test(el)));
}

/** Obtains the blacklisted files list. */
export async function getBlacklist () {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { github }: { github: gh } = require('../../auth');

  try {
    const response = await fetch(`https://api.github.com/gists/${github.gist}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${github.token}`
      },
      method: 'GET'
    });

    if (!response.ok) throw null;

    const json = await response.json();
    const files: any = Object.values(json.files);
    const file = files.find(el => el.filename === '.blacklist');

    if (!file) throw null;

    let list: string[] = null;

    if (file.truncated) {
      const _response = await fetch(file.raw_url);

      if (!_response.ok) throw null;

      const _body = await response.text();

      list = _body.split('\n');
    } else list = file.content.split('\n');

    return list;
  } catch (err) {
    if (err && err.stack) throw err;

    return [];
  }
}
