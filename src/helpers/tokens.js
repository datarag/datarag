const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a salted hash from token
 *
 * @param {String} token
 * @param {string} [salt=config.get('secrets:api_token_salt')]
 * @return {String}
 */
function hashToken(token, salt = config.get('secrets:api_token_salt')) {
  return crypto.createHash('sha256').update(`${salt}:${token}`).digest('hex');
}

module.exports = {
  hashToken,
};
