/**
 * [Remote] Database config
 */
exports.database = {
  acquireConnectionTimeout: 10000,
  client: 'mysql2',
  connection: {
    database: 'kamihime',
    host: 'warspite.gg',
    password: 'uvwevevwe',
    user: 'ossas'
  },
  pool: {
    max: 10,
    min: 0
  }
};

/**
 * [Remote] SSH Credentials
 * Key as auth is recommended.
 */
exports.ssh = {
  host: 'warspite.gg',
  port: '1337',
  username: 'warspite',
  identity: '/home/warspite/cron/private_key'
};

/**
 * [Remote] Destinations
 * Paths should end with `/`.
 */
exports.destinations = {
  scenarios: '/home/warspite/myStatic/scenarios/',
  zips: '/home/warspite/myStatic/zips/'
};
