const {
  breakIntoSectionsByHeading,
  splitParagraphIntoSentences,
  cleanText,
  flattenText,
  chunkifyMarkdown,
} = require('../src/helpers/chunker');

describe('breakIntoSectionsByHeading', () => {
  it('should break content into sections based on heading 1', () => {
    const markdownText = `
# Header 1
Some introductory text.

## Subheader 1.1
Content under subheader 1.1. More text to ensure it's somewhat lengthy.

# Header 2
Content under header 2.

## Subheader 2.1
Content under subheader 2.1.
`;

    const result = breakIntoSectionsByHeading(markdownText);
    expect(result).toEqual([
      {
        heading: 'Header 1',
        text: 'Some introductory text.\n\n## Subheader 1.1\nContent under subheader 1.1. More text to ensure it\'s somewhat lengthy.',
      },
      {
        heading: 'Header 2',
        text: 'Content under header 2.\n\n## Subheader 2.1\nContent under subheader 2.1.',
      },
    ]);
  });

  it('should break content into sections based on heading 2', () => {
    const markdownText = `
## Subheader 1.1
Content under subheader 1.1. More text to ensure it's somewhat lengthy.

### Subheader 1.1.1
Even more detailed content.

## Subheader 1.2
Another subheader with content.
`;
    const result = breakIntoSectionsByHeading(markdownText, 2);
    expect(result).toEqual([
      {
        heading: 'Subheader 1.1',
        text: 'Content under subheader 1.1. More text to ensure it\'s somewhat lengthy.\n\n### Subheader 1.1.1\nEven more detailed content.',
      },
      {
        heading: 'Subheader 1.2',
        text: 'Another subheader with content.',
      },
    ]);
  });

  it('should handle content without any headings', () => {
    const markdownText = `
This is just some text without any headings.

It should be treated as a single section.
`;

    const result = breakIntoSectionsByHeading(markdownText);
    expect(result).toEqual([
      {
        heading: '',
        text: 'This is just some text without any headings.\n\nIt should be treated as a single section.',
      },
    ]);
  });

  it('should handle content without text before headings', () => {
    const markdownText = `
This is just some text without any headings.

# Heading 1
It should be treated as a single section.
`;

    const result = breakIntoSectionsByHeading(markdownText);
    expect(result).toEqual([
      {
        heading: '',
        text: 'This is just some text without any headings.',
      },
      {
        heading: 'Heading 1',
        text: 'It should be treated as a single section.',
      },
    ]);
  });

  it('should handle empty content', () => {
    const markdownText = '';

    const result = breakIntoSectionsByHeading(markdownText);
    expect(result).toEqual([]);
  });

  it('should handle content with only one heading', () => {
    const markdownText = `
# Header 1
Some introductory text.
`;

    const result = breakIntoSectionsByHeading(markdownText);
    expect(result).toEqual([{
      text: 'Some introductory text.',
      heading: 'Header 1',
    }]);
  });
});

describe('splitParagraphIntoSentences', () => {
  it('should split a paragraph into sentences', () => {
    const paragraph = 'This is the first sentence. Here is the second sentence! And this is the third sentence? Here\'s another one.';
    const expected = [
      'This is the first sentence.',
      'Here is the second sentence!',
      'And this is the third sentence?',
      'Here\'s another one.',
    ];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });

  it('should handle a single sentence', () => {
    const paragraph = 'This is a single sentence.';
    const expected = [
      'This is a single sentence.',
    ];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });

  it('should handle an empty string', () => {
    const paragraph = '';
    const expected = [];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });

  it('should handle multiple sentences without proper spacing', () => {
    const paragraph = 'This is the first sentence.Here is the second sentence!And this is the third sentence?Here\'s another one.';
    const expected = [
      'This is the first sentence.',
      'Here is the second sentence!',
      'And this is the third sentence?',
      'Here\'s another one.',
    ];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });

  it('should handle sentences with abbreviations', () => {
    const paragraph = 'Dr. Smith went to Washington. He stayed there for 10 days. Then he returned to N.Y. in the evening.';
    const expected = [
      'Dr. Smith went to Washington.',
      'He stayed there for 10 days.',
      'Then he returned to N.Y. in the evening.',
    ];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });

  it('should handle sentences in other languages', () => {
    const paragraph = 'Γειά σας!你好，世界';
    const expected = [
      'Γειά σας!',
      '你好，世界',
    ];

    const result = splitParagraphIntoSentences(paragraph);
    expect(result).toEqual(expected);
  });
});

describe('cleanText', () => {
  it('should remove emojis', () => {
    const text = 'Hello 🌍! How are you 😊?';
    const expected = 'Hello ! How are you ?';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should remove hashtags', () => {
    const text = 'Hello #world! This is a #test.';
    const expected = 'Hello ! This is a .';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should replace multiple spaces with a single space', () => {
    const text = 'This  is   a    test.';
    const expected = 'This is a test.';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should replace multiple new lines with two new lines', () => {
    const text = 'This is a test.\n\n\n\nThis should be two new lines.';
    const expected = 'This is a test.\n\nThis should be two new lines.';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should trim leading and trailing spaces from each line', () => {
    const text = '  This is a line with spaces.   \n   Another line with spaces.   ';
    const expected = 'This is a line with spaces.\nAnother line with spaces.';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should handle a combination of all cleaning tasks', () => {
    const text = '  Hello #world! 🌍🌍  This  is   a    test.\n\n\n\n  How are you 😊?   ';
    const expected = 'Hello ! This is a test.\n\nHow are you ?';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should handle empty string', () => {
    const text = '';
    const expected = '';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });

  it('should handle text without noise', () => {
    const text = 'This is a clean text without noise.';
    const expected = 'This is a clean text without noise.';
    const result = cleanText(text);
    expect(result).toBe(expected);
  });
});

describe('flattenText', () => {
  it('should remove horizontal rules', () => {
    const text = 'Some text\n\n---\n\nMore text';
    const expected = 'Some text More text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should strip list leaders', () => {
    const text = '- item 1\n* item 2\n+ item 3\n1. item 4';
    const expected = 'item 1 item 2 item 3 item 4';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove HTML tags', () => {
    const text = 'Some <b>bold</b> text';
    const expected = 'Some bold text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should preserve snippets', () => {
    const text = 'Some %START%bold%END% text';
    const result = flattenText(text);
    expect(result).toBe(text);
  });

  it('should remove setext-style headers', () => {
    const text = 'Header\n======\n\nSubheader\n------\n\nText';
    const expected = 'Header Subheader Text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove footnotes', () => {
    const text = 'Some text[^1]\n\n[^1]: Footnote';
    const expected = 'Some text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove images', () => {
    const text = 'Some text ![alt text](image.jpg)';
    const expected = 'Some text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove inline links', () => {
    const text = 'Some [linked text](http://example.com)';
    const expected = 'Some linked text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove blockquotes', () => {
    const text = '> Some quoted text';
    const expected = 'Some quoted text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove reference-style links', () => {
    const text = 'Some text\n\n[1]: http://example.com';
    const expected = 'Some text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove atx-style headers', () => {
    const text = '# Header\n\n## Subheader\n\nText';
    const expected = 'Header Subheader Text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove * emphasis', () => {
    const text = 'Some *emphasized* text';
    const expected = 'Some emphasized text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove _ emphasis', () => {
    const text = 'Some _emphasized_ text';
    const expected = 'Some emphasized text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove code blocks', () => {
    const text = '```\ncode block\n```';
    const expected = 'code block';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove inline code', () => {
    const text = 'Some `inline code` text';
    const expected = 'Some inline code text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should replace strike through', () => {
    const text = 'Some ~striked~ text';
    const expected = 'Some striked text';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove new lines', () => {
    const text = 'Some text\nwith new lines';
    const expected = 'Some text with new lines';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should remove multiple spaces', () => {
    const text = 'Some   text  with  multiple spaces';
    const expected = 'Some text with multiple spaces';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should handle empty string', () => {
    const text = '';
    const expected = '';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });

  it('should handle text without any markdown', () => {
    const text = 'Just a plain text.';
    const expected = 'Just a plain text.';
    const result = flattenText(text);
    expect(result).toBe(expected);
  });
});

describe('chunkifyMarkdown', () => {
  it('should split a simple markdown text into chunks of specified size', () => {
    const markdownText = `
      # Header 1
      This is a simple paragraph with enough words to exceed the chunk size limit. We want to ensure it splits correctly.

      # Header 2
      Another paragraph here that will be split as well.
    `;
    const chunkSize = 10; // Maximum number of words per chunk
    const chunkWindow = 5; // Number of words for overlapping window

    const chunks = chunkifyMarkdown(markdownText, chunkSize, chunkWindow);
    expect(chunks).toEqual([
      'Header 1 - This is a simple paragraph with enough words to exceed the chunk size limit.',
      'Header 1 - We want to ensure it splits correctly.',
      'Header 2 - Another paragraph here that will be split as well.',
    ]);
  });

  it('should handle markdown with nested headings correctly', () => {
    const markdownText = `
      # Header 1
      This is a paragraph under header 1. It should be split properly into chunks.

      ## Subheader 1.1
      This is a paragraph under subheader 1.1. It continues with more text that could be long enough to need splitting.

      ### Subheader 1.1.1
      Even more detailed text here that should also be chunked accordingly based on the max words limit.
    `;
    const chunkSize = 15; // Maximum number of words per chunk
    const chunkWindow = 5; // Number of words for overlapping window

    const chunks = chunkifyMarkdown(markdownText, chunkSize, chunkWindow);
    expect(chunks).toEqual([
      'Header 1 - This is a paragraph under header 1. It should be split properly into chunks.',
      'Header 1 - Subheader 1.1 This is a paragraph under subheader 1.1.',
      'Header 1 - It continues with more text that could be long enough to need splitting.',
      'Header 1 - Subheader 1.1.1 Even more detailed text here that should also be chunked accordingly based on the max words limit.',
    ]);
  });

  it('should handle markdown with various elements correctly', () => {
    const markdownText = `
      # Header 1
      This paragraph has multiple elements including **bold text**, _italic text_, and [a link](http://example.com). It also has some code \`inline code\` and a list:
      - Item 1
      - Item 2

      Another paragraph with more text to ensure proper splitting.
    `;
    const chunkSize = 20; // Maximum number of words per chunk
    const chunkWindow = 5; // Number of words for overlapping window

    const chunks = chunkifyMarkdown(markdownText, chunkSize, chunkWindow);
    expect(chunks).toEqual([
      'Header 1 - This paragraph has multiple elements including bold text, italic text, and a link.',
      'Header 1 - It also has some code inline code and a list: Item 1 Item 2',
      'Header 1 - Another paragraph with more text to ensure proper splitting.',
    ]);
  });

  it('should handle chunk windowing', () => {
    const markdownText = `
      This is a long dog with a tail. And this is a cat. And this is a cow.
    `;
    const chunkSize = 8; // Maximum number of words per chunk
    const chunkWindow = 5; // Number of words for overlapping window

    const chunks = chunkifyMarkdown(markdownText, chunkSize, chunkWindow);
    expect(chunks).toEqual([
      'This is a long dog with a tail.',
      'And this is a cat.',
      'And this is a cat. And this is a cow.',
    ]);
  });
});
