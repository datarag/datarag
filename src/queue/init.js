const logger = require('../logger');
const { getQueue } = require('./index');
const Worker = require('./worker');

let isInitialized = false;
const NUM_WORKERS = 4;

/**
 * Initialize the queue system.
 */
async function initializeQueue() {
  if (isInitialized) return;
  isInitialized = true;
  logger.info('worker', `Starting ${NUM_WORKERS} workers`);
  getQueue().process(NUM_WORKERS, Worker);
}

module.exports = {
  initializeQueue,
};
