const zlib = require('zlib');
const _ = require('lodash');
const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const db = require('../src/db/models');
const { serializeDocument, serializeDatasource } = require('../src/helpers/serialize');
const { SCOPE_REPORTS, SCOPE_CHAT } = require('../src/scopes');

const TOKEN = 'org1';

describe('Transactions API', () => {
  let factory;
  let transactionId;
  let chunk;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_REPORTS}` });

    // Create a corresponding chunk in the database
    chunk = await db.Chunk.create({
      OrganizationId: factory.organization.id,
      DatasourceId: factory.datasource.id,
      DocumentId: factory.document.id,
      content: 'This is the text content of chunk1',
      type: 'chunk',
      contentSize: 33,
      contentTokens: 10,
      embedding: _.range(1024),
    });

    // Create a sample RagLog with a compressed log for testing
    const sampleLog = JSON.stringify({
      dt: {
        chunk_ref: chunk.id,
        document_ref: chunk.DocumentId,
        datasource_ref: chunk.DatasourceId,
      },
      cld: [],
    });
    const compressedLog = zlib.brotliCompressSync(sampleLog);

    const ragLog = await db.RagLog.create({
      OrganizationId: factory.organization.id,
      ApiKeyId: factory.apiKey.id,
      transactionId: 'test-transaction',
      compressedLog,
      compressedSize: compressedLog.length,
      uncompressedSize: sampleLog.length,
    });

    transactionId = ragLog.transactionId;
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
  });

  describe('GET /v1/transactions/:transaction_id', () => {
    it('should return transaction details with relevant chunks', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        rag_log: {
          dt: {
            chunk_ref: chunk.id,
            datasource_ref: chunk.DatasourceId,
            document_ref: chunk.DocumentId,
          },
          cld: [],
        },
        chunks: [{
          chunk_ref: chunk.id,
          text: 'This is the text content of chunk1',
        }],
        documents: [{
          document_ref: chunk.DocumentId,
          document: serializeDocument(factory.document),
        }],
        datasources: [{
          datasource_ref: chunk.DatasourceId,
          datasource: serializeDatasource(factory.datasource),
        }],
      });
    });

    it('should return 404 if the transaction is not found', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/transactions/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should return 401 if the user is not authorized', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/transactions/${transactionId}`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should return 401 if scope is invalid', async () => {
      await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });

      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });
  });
});
