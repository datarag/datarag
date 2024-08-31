const { Redis } = require('ioredis');

/**
 * Create a redis client
 *
 * @return {*}
 */
function createClient() {
  const opts = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  if (process.env.REDIS_CONNECT_URL.toLowerCase().indexOf('rediss://') === 0) {
    opts.tls = {
      rejectUnauthorized: false,
    };
  }
  return new Redis(process.env.REDIS_CONNECT_URL, opts);
}

module.exports = {
  createClient,
};
