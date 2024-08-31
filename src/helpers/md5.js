const { createHash } = require('crypto');

/**
 * Create MD5 sum of text
 *
 * @param {String} data
 * @return {String}
 */
function md5(data) {
  return createHash('md5').update(data).digest('hex');
}

module.exports = md5;
