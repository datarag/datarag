/* eslint-disable global-require */
/* eslint-disable no-console */

if (process.env.NEWRELIC_KEY) {
  require('newrelic');
}

require('./server').start();

function shutdown(signal) {
  return (err) => {
    console.log(`${signal}...`);
    if (err) console.error(err.stack || err);
    setTimeout(() => {
      console.log('...waited 5s, exiting.');
      process.exit(err ? 1 : 0);
    }, 5000).unref();
  };
}

if (process.env.NODE_ENV === 'production') {
  process
    .on('SIGTERM', shutdown('SIGTERM'))
    .on('SIGINT', shutdown('SIGINT'));
}
