const { setupOrg, tearDownOrg, waitWorker } = require('./factory');
const indexDocument = require('../src/queue/jobs/indexDocument');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('IndexDocument Worker', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await setupOrg(OTHER_TOKEN);
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
    await tearDownOrg(OTHER_TOKEN);
  });

  it('should index', async () => {
    await factory.document.update({
      content: 'Hello world',
      contentType: 'text',
    });

    await indexDocument({
      document_id: factory.document.id,
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content.trim()).toEqual(`# Document Summary: ${TOKEN}\n\nHello world`);
  });

  it('should index with shallow knowledge', async () => {
    await factory.document.update({
      content: 'Hello world',
      contentType: 'text',
    });

    await indexDocument({
      document_id: factory.document.id,
      knowledge: 'shallow',
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content.trim()).toEqual('Hello world');
  });
});
