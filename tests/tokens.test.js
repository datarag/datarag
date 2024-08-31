const { hashToken } = require('../src/helpers/tokens');

describe('helpers/tokens', () => {
  it('hashToken', () => {
    expect(hashToken('foo', 'salt')).toEqual('53b33831753b915e0fc673d16ab65098e657ab66555cc383e9132838addb05da');
  });
});
