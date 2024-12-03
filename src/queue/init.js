const logger = require('../logger');
const { getQueue, addCron, getCron } = require('./index');
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

  logger.info('worker', 'Starting cron');
  getCron().process(1, Worker);

  // Add cron jobs
  addCron('cron:clean_raglog', {
    type: 'clean_raglog',
  }, '0 0 * * *');

  addCron('cron:clean_embeddings', {
    type: 'clean_embeddings',
  }, '0 1 * * *');
}

module.exports = {
  initializeQueue,
};
