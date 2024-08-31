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

/**
 * Generate a random hash
 *
 * @param {number} [length=6]
 * @return {String}
 */
function generateRandomHash(length = 6) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

module.exports = {
  hashToken,
  generateRandomHash,
};
