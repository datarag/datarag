const { isSafeUrl, convertToFunctionName } = require('../src/helpers/utils');

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
});
