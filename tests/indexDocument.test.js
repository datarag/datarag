const fs = require('fs');
const { setupOrg, tearDownOrg, waitWorker } = require('./factory');
const indexDocument = require('../src/workers/indexDocument');

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

  it('should index text', async () => {
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
    expect(chunks[0].content).toEqual('Hello world');
  });

  it('should index markdown', async () => {
    await factory.document.update({
      content: '*Hello world*',
      contentType: 'markdown',
    });

    await indexDocument({
      document_id: factory.document.id,
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toEqual('*Hello world*');
  });

  it('should index html', async () => {
    await factory.document.update({
      content: '<b>Hello world</b>',
      contentType: 'html',
    });

    await indexDocument({
      document_id: factory.document.id,
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toEqual('**Hello world**');
  });

  it('should index url', async () => {
    await factory.document.update({
      content: '<b>Hello world</b>',
      contentType: 'url',
    });

    await indexDocument({
      document_id: factory.document.id,
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('**Hello world**');
  });

  it('should index pdf', async () => {
    const binaryData = fs.readFileSync(`${__dirname}/helloworld.pdf`);
    const base64String = binaryData.toString('base64');

    await factory.document.update({
      content: base64String,
      contentType: 'pdf',
    });

    await indexDocument({
      document_id: factory.document.id,
    });

    waitWorker();

    const chunks = await factory.document.getChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('Hello, world!');
  });
});
