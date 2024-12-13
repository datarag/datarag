const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns');
const isPrivateIp = require('private-ip');
const { parse } = require('url');

/**
 * Check if URL is safe (and not internal)
 *
 * @param {String} url
 * @return {Promise<Boolean>}
 */
function isSafeUrl(url) {
  return new Promise((resolve) => {
    if (url.indexOf('/../') !== -1 || url.indexOf('/./') !== -1) {
      resolve(false);
      return;
    }

    const { hostname } = parse(url);
    if (!hostname) {
      resolve(false);
      return;
    }
    dns.lookup(hostname, (err, address) => {
      if (err || !address) {
        resolve(false);
        return;
      }
      resolve(!isPrivateIp(address));
    });
  });
}

function cleanHtml(htmlContent) {
  // Load the HTML content into Cheerio
  const $ = cheerio.load(htmlContent);

  // Remove all header, footer, nav, and iframe elements
  $('svg, nav, .nav, .navigation, header, footer, .footer, aside, script, style, img, iframe').remove();

  // Remove all attributes from remaining elements except 'href'
  $('*').each((_, element) => {
    const attributes = Object.keys(element.attribs);
    attributes.forEach((attr) => {
      if (attr.toLowerCase() !== 'href') {
        $(element).removeAttr(attr);
      }
    });
  });

  // Remove empty elements recursively
  $('*').each((_, element) => {
    if (!$(element).text().trim() && $(element).children().length === 0) {
      $(element).remove();
    }
  });

  // Remove all comments
  $('*').contents().each((_, node) => {
    if (node.type === 'comment') {
      $(node).remove();
    }
  });

  // Clean anchor text and handle invalid hrefs
  $('a').each((_, anchor) => {
    const $anchor = $(anchor);
    const href = $anchor.attr('href');
    const invalidHref = !href || /^(javascript:|void\(\)|#|data:|mailto:|tel:|\s*$)/i.test(href.trim());

    if ($anchor.text().trim()) {
      $anchor.text($anchor.text().replace(/\s+/g, ' ').trim());
    }

    if (!$anchor.text().trim()) {
      $anchor.remove();
    } else if (invalidHref) {
      $anchor.replaceWith(`<span>${$anchor.text()}</span>`);
    }
  });

  return $('body').html();
}

/**
 * Get and clean HTML from URL
 *
 * @param {String} url
 * @return {String}
 */
async function fetchAndCleanHtml(url) {
  if (!(await isSafeUrl(url))) {
    throw new Error(`Url ${url} is not safe`);
  }

  const response = await axios.get(url);

  return cleanHtml(response.data);
}

/**
 * Count words in string
 *
 * @param {String} str
 * @return {Number}
 */
function countWords(str) {
  return str.trim().split(/\s+/).length;
}

/**
 * Trim text up to max words
 *
 * @param {*} text
 * @param {*} maxWords
 * @return {*}
 */
function trimTextToMaxWords(text, maxWords) {
  // Split the text into words
  const words = text.split(' ');

  // Check if the text is already within the limit
  if (words.length <= maxWords) {
    return text;
  }

  // Trim the text to the maximum number of words
  const trimmedWords = words.slice(0, maxWords);

  // Join the words back into a string
  return trimmedWords.join(' ');
}

/**
 * Consine similarity between vectors
 *
 * @param {Array} vecA
 * @param {Array} vecB
 * @return {Number}
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i += 1) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert a string to a function name
 *
 * @param {String} str
 * @return {String}
 */
function convertToFunctionName(str) {
  let functionName = (str || '').trim().toLowerCase();
  functionName = functionName.replace(/\s+/g, '_');
  functionName = functionName.replace(/[^a-z0-9_]/g, '');
  if (/^\d/.test(functionName)) {
    functionName = `_${functionName}`;
  }
  return functionName;
}

/**
 * Create a dynamic named function
 *
 * @param {String} name
 * @param {*} body
 * @return {*}
 */
function nameFunction(name, body) {
  return {
    [name](...args) {
      return body.apply(this, args);
    },
  }[name];
}

/**
 * Find the median of an array of numbers
 *
 * @param {[Number]} arr
 * @return {Number}
 */
function findMedian(arr) {
  arr.sort((a, b) => a - b);
  const len = arr.length;
  if (len % 2 === 1) {
    return arr[Math.floor(len / 2)];
  }

  const mid1 = arr[len / 2 - 1];
  const mid2 = arr[len / 2];
  return (mid1 + mid2) / 2;
}

/**
 * Find the average of an array of numbers
 *
 * @param {[Number]} arr
 * @return {Number}
 */
function findAverage(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((acc, val) => acc + val, 0);
  const average = sum / arr.length;
  return average;
}

/**
 * Trims a string to a maximum length of X characters.
 *
 * @param {string} str - The string to be trimmed.
 * @param {number} maxLength - The maximum number of characters to retain.
 * @returns {string} - The trimmed string.
 */
function trimString(str, maxLength) {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength);
}

module.exports = {
  isSafeUrl,
  cleanHtml,
  fetchAndCleanHtml,
  countWords,
  trimTextToMaxWords,
  trimString,
  cosineSimilarity,
  convertToFunctionName,
  nameFunction,
  findMedian,
  findAverage,
};
