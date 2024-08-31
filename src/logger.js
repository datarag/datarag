const events = require('events');
const winston = require('winston');

let level = 'debug';
if (process.env.NODE_ENV === 'test') {
  level = 'none';
} else if (process.env.NODE_ENV === 'production') {
  level = 'info';
}

const logger = winston.createLogger({
  level,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
  ],
});

const EVENT_EMITTER = new (events.EventEmitter)();

function buildLog(reason, object) {
  let msg = `[${reason}] `;
  if (object) {
    // string type
    if (typeof object === 'string') msg += object;
    // backbone model
    else if (object.toLog) {
      msg += object.toLog();
    } else if (object instanceof Error) {
      msg += object.toString();
    } else {
      msg += JSON.stringify(object);
    }
  }
  return msg;
}

module.exports = {
  onError: (fn) => {
    EVENT_EMITTER.on('logger:error', fn);
  },
  system: (message) => {
    logger.info(message);
  },
  info: (reason, object) => {
    logger.info(buildLog(reason, object));
  },
  warn: (reason, object) => {
    logger.warn(buildLog(reason, object));
  },
  debug: (reason, object) => {
    logger.debug(buildLog(reason, object));
  },
  error: (reason, object) => {
    logger.error(buildLog(reason, object));
    if (object && object instanceof Error) {
      EVENT_EMITTER.emit('logger:error', object);
    }
  },
};
