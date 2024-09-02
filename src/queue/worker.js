const logger = require('../logger');
const indexDocument = require('./jobs/indexDocument');
const cleanRagLog = require('./jobs/cleanRagLog');

function Worker(job) {
  const proc = async () => {
    const now = Date.now();
    logger.info('worker', `Processing job ${job.id}`);
    try {
      const { data } = job;
      if (data.type === 'index') {
        await indexDocument(data);
      } else if (data.type === 'clean_raglog') {
        await cleanRagLog();
      }
    } catch (e) {
      logger.warn('worker', `Failed to process job ${job.id}`);
      logger.error('worker', e);
      throw e; // throw error to restart the job
    }
    logger.info('worker', `Processed job ${job.id} in ${(Date.now() - now) / 1000}sec`);
  };
  return proc();
}

module.exports = Worker;
