const { obfuscateValue, obfuscate } = require('../src/helpers/obfuscator');

describe('Obfuscation Functions', () => {
  describe('obfuscateValue', () => {
    it('should obfuscate a string of length greater than 2', () => {
      const input = 'hello';
      const result = obfuscateValue(input);
      expect(result).toEqual('h[3]o');
    });

    it('should not obfuscate a string of length 2 or less', () => {
      const input1 = 'hi';
      const input2 = 'a';
      const result1 = obfuscateValue(input1);
      const result2 = obfuscateValue(input2);
      expect(result1).toEqual('[2]');
      expect(result2).toEqual('[1]');
    });

    it('should obfuscate a number to a single asterisk', () => {
      const input = 12345;
      const result = obfuscateValue(input);
      expect(result).toEqual('*****');
    });

    it('should obfuscate an object\'s string and number properties', () => {
      const input = {
        name: 'John Doe',
        age: 25,
        address: {
          street: 'Main St',
          number: 123,
        },
      };
      const result = obfuscateValue(input);
      expect(result).toEqual({
        name: 'J[6]e',
        age: '**',
        address: {
          street: 'M[5]t',
          number: '***',
        },
      });
    });

    it('should handle null values in objects', () => {
      const input = {
        name: 'John Doe',
        age: null,
      };
      const result = obfuscateValue(input);
      expect(result).toEqual({
        name: 'J[6]e',
        age: null,
      });
    });

    it('should handle empty objects', () => {
      const input = {};
      const result = obfuscateValue(input);
      expect(result).toEqual({});
    });

    it('should return the original value if it is not a string, number, or object', () => {
      const input = true;
      const result = obfuscateValue(input);
      expect(result).toEqual(true);
    });
  });

  describe('obfuscate', () => {
    it('should obfuscate a string input', () => {
      const input = 'test';
      const result = obfuscate(input);
      expect(result).toEqual('t[2]t');
    });

    it('should obfuscate a number input', () => {
      const input = 123456;
      const result = obfuscate(input);
      expect(result).toEqual('******');
    });

    it('should obfuscate an object input with nested properties', () => {
      const input = {
        username: 'john_doe',
        password: 'super_secret',
        details: {
          email: 'john@example.com',
        },
      };

      const result = obfuscate(input);
      expect(result).toEqual({
        username: 'j[6]e',
        password: 's[10]t',
        details: {
          email: 'j[14]m',
        },
      });
    });

    it('should handle null input', () => {
      const input = null;
      const result = obfuscate(input);
      expect(result).toEqual(null);
    });

    it('should handle an array input', () => {
      const input = ['apple', 'banana', 123];
      const result = obfuscate(input);
      expect(result).toEqual(['a[3]e', 'b[4]a', '***']);
    });
  });
});
