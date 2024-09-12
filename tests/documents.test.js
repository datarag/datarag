const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg, waitWorker } = require('./factory');
const db = require('../src/db/models');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Documents API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_DATA_READ},${SCOPE_DATA_WRITE}` });

    await setupOrg(OTHER_TOKEN);
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
    await tearDownOrg(OTHER_TOKEN);
  });

  describe('GET /datasources/:datasource_id/documents', () => {
    it('should list all documents in a datasource', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        data: [{
          hash: 'abcd',
          id: TOKEN,
          metadata: {
            foo: 'bar',
          },
          name: TOKEN,
          size: 4,
          status: 'indexed',
          type: 'text',
        }],
      });
    });

    it('should handle authentication error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should handle invalid scope', async () => {
      await factory.apiKey.update({ scopes: `${SCOPE_DATA_WRITE}` });

      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources/non-existent/documents')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /datasources/:datasource_id/documents', () => {
    it('should create a new document', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-document',
            name: 'New Document',
            type: 'text',
            content: 'This is the content of the document',
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: 'new-document',
        name: 'New Document',
        type: 'text',
        metadata: { key: 'value' },
      });

      const model = await db.Document.findOne({
        where: {
          resId: 'new-document',
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).not.toBeNull();
      expect(model.status).toEqual('queued');

      await waitWorker();
      await model.reload();
      expect(model.status).toEqual('indexed');
    });

    it('should update an existing document', async () => {
      const agent = supertest.agent(app);
      await agent
        .post(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-document',
            name: 'Existing Document',
            type: 'text',
            content: 'This is the existing content',
          },
        });

      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/documents`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-document',
            name: 'Updated Document',
            type: 'text',
            content: 'This is the updated content',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: 'existing-document',
        name: 'Updated Document',
      });

      const model = await db.Document.findOne({
        where: {
          resId: 'existing-document',
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model.name).toEqual('Updated Document');
      expect(model.content).toEqual('This is the updated content');
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/datasources/non-existent/documents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'non-existent-document',
            name: 'Non-existent Document',
            type: 'text',
            content: 'This is the content',
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /datasources/:datasource_id/documents/:document_id', () => {
    it('should get a document by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/documents/${factory.document.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: factory.document.resId,
        name: factory.document.name,
      });
    });

    it('should handle document not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/documents/non-existent`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources/non-existent/documents/document-id')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /datasources/:datasource_id/documents/:document_id', () => {
    it('should delete a document by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/datasources/${factory.datasource.resId}/documents/${factory.document.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      const model = await db.Document.findOne({
        where: {
          resId: factory.document.resId,
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).toBeNull();
    });

    it('should handle document not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/datasources/${factory.datasource.resId}/documents/non-existent`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/datasources/non-existent/documents/document-id')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
