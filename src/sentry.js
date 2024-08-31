const Sentry = require('@sentry/node');
const logger = require('./logger');
const config = require('./config');

const SENTRY_DSN = config.get('sentry:dsn');

if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN });
  logger.info('sentry', 'Activated!');
} else {
  logger.error('sentry', 'missing configuration');
}

module.exports = {
  expressError: (app) => {
    if (SENTRY_DSN) {
      Sentry.setupExpressErrorHandler(app);
    }
  },
  captureException: (err) => {
    if (SENTRY_DSN) {
      Sentry.captureException(err);
    }
  },
  captureMessage: (msg) => {
    if (SENTRY_DSN) {
      Sentry.captureMessage(msg);
    }
  },
};

logger.onError(module.exports.captureException);
