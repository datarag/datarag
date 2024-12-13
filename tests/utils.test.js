const {
  isSafeUrl,
  convertToFunctionName,
  trimString,
  cleanHtml,
} = require('../src/helpers/utils');

describe('Utility Functions', () => {
  describe('isSafeUrl', () => {
    it('should return false for URLs with /../ or /./', async () => {
      await expect(isSafeUrl('https://example.com/../')).resolves.toBe(false);
      await expect(isSafeUrl('https://example.com/./')).resolves.toBe(false);
    });

    it('should return false for URLs without hostname', async () => {
      await expect(isSafeUrl('not-a-url')).resolves.toBe(false);
    });

    it('should return true for safe URLs', async () => {
      await expect(isSafeUrl('https://example.com')).resolves.toBe(true);
    });
  });

  describe('convertToFunctionName', () => {
    it('converts string to lowercase', () => {
      expect(convertToFunctionName('HELLO')).toBe('hello');
    });

    it('replaces spaces with underscores', () => {
      expect(convertToFunctionName('Hello World')).toBe('hello_world');
    });

    it('removes non-alphanumeric characters', () => {
      expect(convertToFunctionName('Hello@World!')).toBe('helloworld');
    });

    it('handles mixed cases and special characters', () => {
      expect(convertToFunctionName('My Function Name 123!')).toBe('my_function_name_123');
    });

    it('ensures function name does not start with a number', () => {
      expect(convertToFunctionName('123 Function')).toBe('_123_function');
    });

    it('handles empty string', () => {
      expect(convertToFunctionName('')).toBe('');
    });

    it('handles string with only special characters', () => {
      expect(convertToFunctionName('!@#$%^&*()')).toBe('');
    });

    it('handles string with leading and trailing spaces', () => {
      expect(convertToFunctionName('  leading and trailing  ')).toBe('leading_and_trailing');
    });
  });

  describe('trimString', () => {
    it('returns the original string if it is shorter than or equal to the maxLength', () => {
      expect(trimString('Short', 10)).toBe('Short');
    });

    it('trims the string to the specified maxLength', () => {
      expect(trimString('This is a longer string', 10)).toBe('This is a ');
    });

    it('returns an empty string if the input is empty', () => {
      expect(trimString('', 10)).toBe('');
    });

    it('handles maxLength of 0 gracefully', () => {
      expect(trimString('Non-empty', 0)).toBe('');
    });

    it('returns null if the input string is null', () => {
      expect(trimString(null, 10)).toBe(null);
    });

    it('handles undefined input gracefully', () => {
      expect(trimString(undefined, 10)).toBe(undefined);
    });

    it('does not truncate when maxLength equals string length', () => {
      expect(trimString('Exact length', 12)).toBe('Exact length');
    });

    it('handles very large maxLength values', () => {
      expect(trimString('Short string', 1000)).toBe('Short string');
    });

    it('truncates string with spaces correctly', () => {
      expect(trimString('A string with spaces', 10)).toBe('A string w');
    });

    it('handles special characters in the string', () => {
      expect(trimString('Special!@#$%^&*()', 7)).toBe('Special');
    });
  });

  describe('cleanHtml', () => {
    it('removes header, footer, nav, and iframe elements', () => {
      const htmlContent = '<header>Header</header><nav>Nav</nav><iframe></iframe><div>Content</div>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<div>Content</div>');
    });

    it('removes all attributes except href', () => {
      const htmlContent = '<div id="test" class="example" href="keep">Content</div>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<div href="keep">Content</div>');
    });

    it('removes empty elements', () => {
      const htmlContent = '<div></div><span> </span><p>Content</p>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<p>Content</p>');
    });

    it('removes comments', () => {
      const htmlContent = '<div><!-- Comment --></div>';
      const result = cleanHtml(htmlContent);
      expect(result).not.toContain('<!-- Comment -->');
    });

    it('cleans anchor text and converts invalid hrefs to spans', () => {
      const htmlContent = '<a href="javascript:void(0)">Click me</a>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<span>Click me</span>');
    });

    it('removes anchors with empty text', () => {
      const htmlContent = '<a href="https://example.com"></a>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('');
    });

    it('handles nested elements properly', () => {
      const htmlContent = '<div><header>Header</header><p>Text</p></div>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<div><p>Text</p></div>');
    });

    it('keeps valid anchor elements intact', () => {
      const htmlContent = '<a href="https://example.com">Visit</a>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<a href="https://example.com">Visit</a>');
    });

    it('trims and normalizes anchor text', () => {
      const htmlContent = '<a href="https://example.com">   Text   \n\n with   spaces\n </a>';
      const result = cleanHtml(htmlContent);
      expect(result).toBe('<a href="https://example.com">Text with spaces</a>');
    });
  });
});
