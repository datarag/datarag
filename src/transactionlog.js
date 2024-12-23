const zlib = require('zlib');
const _ = require('lodash');
const db = require('./db/models');
const { obfuscate } = require('./helpers/obfuscator');
const config = require('./config');
const logger = require('./logger');
const { trimString } = require('./helpers/utils');

const AUDITLOG_ENABLED = config.get('auditlog:enabled');
const COSTLOG_ENABLED = config.get('costlog:enabled');
const RAGLOG_ENABLED = config.get('raglog:enabled');

async function logTransaction(req, res) {
  try {
    if (AUDITLOG_ENABLED) {
      await db.AuditLog.create({
        OrganizationId: req.organization ? req.organization.id : null,
        ApiKeyId: req.apiKey ? req.apiKey.id : null,
        ipAddress: trimString(req.ip, 255),
        transactionId: req.transactionId,
        action: trimString(`${req.method} ${req.path}`, 255),
        status: `${res.statusCode}`,
        details: _.isObject(req.body) ? JSON.stringify(obfuscate(req.body)) : null,
      });
    }

    if (COSTLOG_ENABLED
      && req.organization
      && req.transactionAction
      && req.transactionCostUSD > 0
    ) {
      await db.CostLog.create({
        OrganizationId: req.organization.id,
        ApiKeyId: req.apiKey ? req.apiKey.id : null,
        transactionId: req.transactionId,
        transactionAction: req.transactionAction,
        costUSD: req.transactionCostUSD,
      });

      logger.info(`Log Cost / ${req.organization.resId}`, `${req.transactionAction} $${req.transactionCostUSD}`);
    }

    if (RAGLOG_ENABLED
      && req.ragLog
      && req.transactionId
      && req.organization
    ) {
      const log = JSON.stringify(req.ragLog.toJSON());
      // Compress the log using Brotli
      const compressedBuffer = await new Promise((resolve, reject) => {
        zlib.brotliCompress(log, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      await db.RagLog.create({
        OrganizationId: req.organization.id,
        ApiKeyId: req.apiKey ? req.apiKey.id : null,
        transactionId: req.transactionId,
        compressedLog: compressedBuffer,
        compressedSize: compressedBuffer.length,
        uncompressedSize: log.length,
      });

      logger.info(`Log RAG / ${req.organization.resId}`, `${log.length} bytes -> ${compressedBuffer.length} bytes compressed (${Math.round((1 - (compressedBuffer.length / Math.max(1, log.length))) * 100)}%)`);
    }
  } catch (err) {
    logger.error('logTransaction', err);
  }
}

module.exports = {
  logTransaction,
};
