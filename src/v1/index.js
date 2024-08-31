const express = require('express');
const db = require('../db/models');
const { hashToken } = require('../helpers/tokens');
const { unauthorizedResponse } = require('../helpers/responses');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UnauthorizedError:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Unauthorized
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *             example: Please verify your credentials
 *       required:
 *         - message
 *         - errors
 *     NotfoundError:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Not found
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *             example: Resource may have been deleted or not been created yet
 *       required:
 *         - message
 *         - errors
 *     BadRequest:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Bad request
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *             example: Invalid field
 *       required:
 *         - message
 *         - errors
 *     Conflict:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Conflict
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *             example: A resource with the same id already exists
 *       required:
 *         - message
 *         - errors
 */

router.use((async (req, res, next) => {
  const auth = (req.headers.authorization || '').split(' ');
  const token = auth[1];

  if (auth[0] !== 'Bearer' || !token) {
    unauthorizedResponse(req, res);
    return;
  }

  const hashedToken = hashToken(token);

  const apiKeyModel = await db.ApiKey.findOne({
    include: [{
      model: db.Organization,
      required: true,
    }],
    where: {
      tokenHash: hashedToken,
    },
  });

  if (!apiKeyModel) {
    unauthorizedResponse(req, res);
    return;
  }

  req.apiKey = apiKeyModel;
  req.organization = apiKeyModel.Organization;

  next();
}));

require('./agents')(router);
require('./datasources')(router);
require('./documents')(router);
require('./connectors')(router);
require('./retrieveChunks')(router);
require('./retrieveDocuments')(router);
require('./chat')(router);

module.exports = router;
