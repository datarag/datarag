const db = require('../../db/models');
const logger = require('../../logger');
const config = require('../../config');

const { Op } = db.Sequelize;

const RETENTION_DAYS = config.get('raglog:retentiondays');

async function cleanRagLog() {
  const rows = await db.RagLog.destroy({
    where: {
      createdAt: {
        [Op.lt]: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    },
  });
  logger.info('cron', `Cleaned ${rows} RAG logs`);
}

module.exports = cleanRagLog;
