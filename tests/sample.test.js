const { Organization } = require('../src/db/models');

describe('Sample', () => {
  it('works', async () => {
    await Organization.create({
      resId: 'a',
    });
    await Organization.create({
      resId: 'b',
    });
    expect(1).toBe(1);
  });
});
