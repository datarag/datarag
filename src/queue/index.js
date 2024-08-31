const Queue = require('bull');
const { createClient } = require('../helpers/ioredis');

const queue = new Queue(`${process.env.NODE_ENV}:default`, {
  createClient: () => createClient(),
});

/**
 * Get queue object
 *
 * @return {*}
 */
function getQueue() {
  return queue;
}

/**
 * Add a job in the queue system. If jobId already exists, job will be
 * discarded.
 *
 * @param {String} jobId
 * @param {Object} payload
 */
async function addJob(jobId, payload) {
  await queue.add(payload, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
  });
}

/**
 * Check if job exists.
 *
 * @param {String} jobId
 */
async function hasJob(jobId) {
  const job = await queue.getJob(jobId);
  return !!job;
}

/**
 * Return the number of jobs in the queue.
 *
 * @return {*}
 */
async function countJobs() {
  const counts = await queue.getJobCounts();
  return counts;
}

module.exports = {
  getQueue,
  addJob,
  hasJob,
  countJobs,
};
