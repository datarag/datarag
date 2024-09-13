const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const { SCOPE_RETRIEVAL, SCOPE_CHAT } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Retrieve Chunks API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_RETRIEVAL}` });

    await setupOrg(OTHER_TOKEN);
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
    await tearDownOrg(OTHER_TOKEN);
  });

  describe('POST /retrieve/chunks', () => {
    it('should retrieve chunks based on a query', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
            max_tokens: 250,
            max_chars: 500,
            max_chunks: 10,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toMatchObject({
        query: 'What is machine learning?',
        processing_time_ms: expect.any(Number),
        transaction_id: expect.any(String),
      });
    });

    it('should handle bad request errors for missing datasources', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
          },
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should handle authentication errors', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', 'Bearer invalid')
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should handle invalid scope', async () => {
      await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });

      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });

    it('should handle empty results if no relevant chunks found', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'Non-existent query',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toEqual(0);
      expect(res.body.meta).toMatchObject({
        query: 'Non-existent query',
        processing_time_ms: expect.any(Number),
        transaction_id: expect.any(String),
      });
    });

    it('should limit the number of retrieved chunks based on max_chunks', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/chunks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
            max_chunks: 1,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });
});

describe('Retrieve Documents API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_RETRIEVAL}` });

    await setupOrg(OTHER_TOKEN);
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
    await tearDownOrg(OTHER_TOKEN);
  });

  describe('POST /retrieve/documents', () => {
    it('should retrieve documents based on a query', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
            max_documents: 10,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toMatchObject({
        query: 'What is machine learning?',
        processing_time_ms: expect.any(Number),
        transaction_id: expect.any(String),
      });
    });

    it('should retrieve documents based on a query with snippets', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: TOKEN,
            datasource_ids: [factory.datasource.resId],
            max_documents: 10,
            snippets: true,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toMatchObject({
        query: TOKEN,
        processing_time_ms: expect.any(Number),
        snippets: [],
        transaction_id: expect.any(String),
      });
    });

    it('should handle bad request errors for missing datasources', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
          },
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should handle authentication errors', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', 'Bearer invalid')
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should handle invalid scope', async () => {
      await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });

      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });

    it('should handle empty results if no relevant documents found', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'Non-existent query',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toEqual(0);
      expect(res.body.meta).toMatchObject({
        query: 'Non-existent query',
        processing_time_ms: expect.any(Number),
        transaction_id: expect.any(String),
      });
    });

    it('should limit the number of retrieved documents based on max_documents', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/retrieve/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            datasource_ids: [factory.datasource.resId],
            max_documents: 1,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });
});
