const _ = require('lodash');
const logger = require('../logger');
const { logTransaction } = require('../transactionlog');

/**
 * Not found response
 *
 * @param {*} req
 * @param {*} res
 */
function notFoundResponse(req, res) {
  res.status(404).json({
    message: 'Not found',
    errors: ['Resource may have been deleted or not been created yet'],
  });
}

/**
 * Bad request response
 *
 * @param {*} req
 * @param {*} res
 */
function badRequestResponse(req, res, error) {
  res.status(400).json({
    message: 'Bad request',
    errors: [error || 'Invalid payload'],
  });
}

/**
 * Unauthorized response
 *
 * @param {*} req
 * @param {*} res
 */
function unauthorizedResponse(req, res, error) {
  res.status(401).json({
    message: 'Unauthorized',
    errors: [error || 'Authentication credentials are missing'],
  });
}

/**
 * Conflict response
 *
 * @param {*} req
 * @param {*} res
 */
function conflictResponse(req, res) {
  res.status(409).json({
    message: 'Conflict',
    errors: ['A resource with the same id already exists'],
  });
}

/**
 * Express middleware to handle errors
 *
 * @param {*} fn
 * @return {*}
 */
function apiRoute(scope, fn) {
  return (req, res, next) => {
    const apiScopes = _.compact((req.apiKey.scopes || '').replace(/ /g, ',').split(','));
    if (apiScopes.indexOf(scope) < 0 && apiScopes.indexOf('*') < 0) {
      unauthorizedResponse(req, res, 'Invalid API scopes');
      return;
    }
    Promise.resolve(fn(req, res, next))
      .then(() => {
        logTransaction(req, res);
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log(err);
        }
        logger.error('apiRoute', err);
        res.status(500).json({
          message: 'Internal server error',
          errors: [],
        });
      });
  };
}

module.exports = {
  apiRoute,
  notFoundResponse,
  unauthorizedResponse,
  conflictResponse,
  badRequestResponse,
};
