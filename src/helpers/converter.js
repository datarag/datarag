const pdf2md = require('@opendocsg/pdf2md');
const TurndownService = require('turndown');
const { fetchAndCleanHtml } = require('./utils');

const turndownService = new TurndownService();

/**
 * Convert content to markdown
 *
 * @param {*} { content, type }
 * @return {String}
 */
async function convertSource({ content, type }) {
  // Markdown content
  let convertedContent = content;
  // Preprocess
  if (type === 'url') {
    convertedContent = await fetchAndCleanHtml(content);
  }
  // Convert text to Markdown
  switch (type) {
    case 'pdf':
      convertedContent = await pdf2md(
        Uint8Array.from(atob(convertedContent), (c) => c.charCodeAt(0)),
      );
      break;
    case 'url':
    case 'html':
      convertedContent = turndownService.turndown(convertedContent);
      break;
    case 'text':
    case 'markdown':
    default:
      break;
  }

  return (convertedContent || '').trim();
}

module.exports = {
  convertSource,
};
