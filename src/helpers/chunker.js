const marked = require('marked');
const _ = require('lodash');
const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const { countWords } = require('./utils');

const nlp = winkNLP(model);

/**
 * Break into sections by markdown heading
 *
 * @param {String} content
 * @param {number} [depth=1]
 * @return {[]}
 */
function breakIntoSectionsByHeading(content, depth = 1) {
  const lexer = new marked.Lexer();
  const tokens = lexer.lex(content);

  const sections = [];
  let currentHeading = '';
  let currentChunk = '';

  tokens.forEach((token) => {
    if (token.type === 'heading' && token.depth === depth) {
      if (currentChunk.trim().length > 0) {
        sections.push({ heading: currentHeading, text: currentChunk.trim() });
      }
      currentHeading = token.text;
      currentChunk = '';
    } else {
      currentChunk += token.raw;
    }
  });

  if (currentChunk.trim().length > 0) {
    sections.push({ heading: currentHeading, text: currentChunk.trim() });
  }

  return sections;
}

/**
 * Split paragraph into sentences
 *
 * @param {*} paragraph
 * @return {[]}
 */
function splitParagraphIntoSentences(paragraph) {
  const doc = nlp.readDoc(paragraph);
  return _.compact(doc.sentences().out());
}

/**
 * Remove emojis, hashtags, multiple spaces and new lines from text
 *
 * @param {String} text
 * @return {String}
 */
function cleanText(text) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const hashtagsRegex = /#[\w]+/g;
  const multipleSpacesRegex = /  +/g;
  const multipleNewLinesRegex = /[\r\n]{3,}/g;

  let cleanedText = (text || '');
  cleanedText = cleanedText.replace(emojiRegex, '');
  cleanedText = cleanedText.replace(hashtagsRegex, '');
  cleanedText = cleanedText.replace(multipleSpacesRegex, ' ');
  cleanedText = cleanedText.replace(multipleNewLinesRegex, '\n\n');
  cleanedText = cleanedText.split('\n').map((line) => line.trim()).join('\n');

  return cleanedText;
}

/**
 * Remove markdown from text
 *
 * @param {String} markdownText
 * @return {String}
 */
function flattenText(markdownText) {
  return (markdownText || '')
    // Horizontal rules
    .replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*/gm, '')
    // Strip list leaders
    .replace(/^([\s\t]*)([*\-+]|\d+\.)\s+/gm, '$1')
    // Header
    .replace(/\n={2,}/g, '\n')
    // Strikethrough
    .replace(/~~/g, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove setext-style headers
    .replace(/^[=-]{2,}\s*$/g, '')
    // Remove footnotes
    .replace(/\[\^.+?\](: .*?$)?/g, '')
    .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
    // Remove images
    .replace(/!\[(.*?)\][[(].*?[\])]/g, '')
    // Remove inline links
    .replace(/\[([^\]]*?)\][[(].*?[\])]/g, '$1')
    // Remove blockquotes
    .replace(/^(\n)?\s{0,3}>\s?/gm, '$1')
    // Remove reference-style links
    .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
    // Remove atx-style headers
    .replace(/^(\n)?\s{0,}#{1,6}\s*( (.+))? +#+$|^(\n)?\s{0,}#{1,6}\s*( (.+))?$/gm, '$1$3$4$6')
    // Remove * emphasis
    .replace(/([*]+)(\S)(.*?\S)??\1/g, '$2$3')
    // Remove _ emphasis.
    .replace(/(^|\W)([_]+)(\S)(.*?\S)??\2($|\W)/g, '$1$3$4$5')
    // Remove code blocks
    .replace(/```([\s\S]*?)```/g, '$1')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Replace strike through
    .replace(/~(.*?)~/g, '$1')
    // Remove new lines
    .replace(/\n/g, ' ')
    // Remove multiple spaces
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Break markdown into chunks
 *
 * @param {String} markDownText
 * @param {number} [chunkSize=200]
 * @param {number} [chunkWindow=50]
 * @return {[]}
 */
function chunkifyMarkdown(markDownText, chunkSize = 200, chunkWindow = 50) {
  const chunks = [];

  function recursiveSplit(textBlock, headings, depth) {
    if (countWords(textBlock) <= chunkSize) {
      chunks.push({
        headings,
        text: textBlock,
      });
      return;
    }
    // Further split
    const sections = breakIntoSectionsByHeading(textBlock, depth);
    if (sections.length === 0) return;
    if (sections.length > 1) {
      _.each(sections, (section) => {
        recursiveSplit(
          section.text,
          _.compact(_.uniq([...headings, flattenText(section.heading)])),
          depth + 1,
        );
      });
      return;
    }
    const subHeadings = _.compact(_.uniq([...headings, flattenText(sections[0].heading)]));
    // eslint-disable-next-line no-param-reassign
    textBlock = sections[0].text;
    if (countWords(textBlock) <= chunkSize) {
      chunks.push({
        headings: subHeadings,
        text: textBlock,
      });
    } else {
      let maxChunkSize = chunkSize;
      let sentences = splitParagraphIntoSentences(textBlock);
      sentences = _.map(sentences, (sentence) => {
        const words = countWords(sentence);
        maxChunkSize = Math.max(maxChunkSize, words);
        return {
          text: sentence,
          words,
        };
      });

      let currentChunk = [];
      let currentWordCount = 0;
      let i = 0;

      while (i < sentences.length) {
        const { text, words } = sentences[i];

        if (currentWordCount + words <= maxChunkSize) {
          currentChunk.push(text);
          currentWordCount += words;
        } else {
          chunks.push({
            headings: subHeadings,
            text: currentChunk.join(' '),
          });
          currentChunk = [];
          currentWordCount = 0;

          currentChunk.push(text);
          currentWordCount += words;

          let overlapWords = 0;
          let j = i - 1;
          while (j >= 0) {
            if (overlapWords + sentences[j].words <= chunkWindow) {
              overlapWords += sentences[j].words;
              currentChunk.unshift(sentences[j].text);
              j -= 1;
            } else {
              break;
            }
          }
        }

        i += 1;
      }

      if (currentChunk.length > 0) {
        chunks.push({
          headings: subHeadings,
          text: currentChunk.join(' '),
        });
      }
    }
  }

  let cleanMarkDownText = markDownText;
  // Remove images
  cleanMarkDownText = cleanMarkDownText.replace(/!\[.*?\]\(.*?\)/g, '');
  // Replace links with actual link text
  cleanMarkDownText = cleanMarkDownText.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // Start recursive split
  recursiveSplit(cleanText(cleanMarkDownText), [], 1);

  const joinHeadings = (headings) => {
    if (_.isEmpty(headings)) return '';
    return `${headings.join(' - ')} -`;
  };

  return _.map(chunks, (entry) => `${joinHeadings(entry.headings)} ${flattenText(entry.text)}`.trim());
}

module.exports = {
  breakIntoSectionsByHeading,
  splitParagraphIntoSentences,
  cleanText,
  flattenText,
  chunkifyMarkdown,
};
