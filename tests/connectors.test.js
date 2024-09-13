const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const db = require('../src/db/models');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Connectors API', () => {
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

  describe('GET /datasources/:datasource_id/connectors', () => {
    it('should list all connectors in a datasource', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        data: [{
          id: TOKEN,
          name: TOKEN,
          purpose: 'purpose',
          endpoint: 'https://www.example.com',
          method: 'get',
          payload: {},
          metadata: {
            foo: 'bar',
          },
        }],
      });
    });

    it('should handle authentication error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/connectors`)
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
        .get(`/v1/datasources/${factory.datasource.resId}/connectors`)
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
        .get('/v1/datasources/non-existent/connectors')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /datasources/:datasource_id/connectors', () => {
    it('should create a new connector', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-connector',
            name: 'New Connector',
            purpose: 'This is a new connector',
            endpoint: 'https://www.example.com',
            method: 'post',
            payload: {
              param: {
                type: 'number',
                required: false,
                description: 'Foo',
              },
            },
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: 'new-connector',
        name: 'New Connector',
        purpose: 'This is a new connector',
        endpoint: 'https://www.example.com',
        method: 'post',
        payload: {
          param: {
            type: 'number',
            required: false,
            description: 'Foo',
          },
        },
        metadata: { key: 'value' },
      });

      const model = await db.Connector.findOne({
        where: {
          resId: 'new-connector',
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).not.toBeNull();
    });

    it('should update an existing connector', async () => {
      const agent = supertest.agent(app);
      await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-connector',
            name: 'Existing Connector',
            purpose: 'This is an existing connector',
            endpoint: 'https://www.example.com',
            method: 'post',
            payload: {},
          },
        });

      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-connector',
            name: 'Updated Connector',
            purpose: 'This is an updated connector',
            endpoint: 'https://www.example.com/',
            method: 'post',
            payload: {
              param: {
                type: 'number',
                required: false,
                description: 'Foo',
              },
            },
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: 'existing-connector',
        name: 'Updated Connector',
        purpose: 'This is an updated connector',
        endpoint: 'https://www.example.com/',
        method: 'post',
        payload: {
          param: {
            type: 'number',
            required: false,
            description: 'Foo',
          },
        },
        metadata: { key: 'value' },
      });

      const model = await db.Connector.findOne({
        where: {
          resId: 'existing-connector',
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model.name).toEqual('Updated Connector');
      expect(model.purpose).toEqual('This is an updated connector');
    });

    it('should validate method', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-connector',
            name: 'New Connector',
            purpose: 'This is a new connector',
            endpoint: 'https://www.example.com',
            method: 'invalid',
            payload: {
              param: {
                type: 'number',
                required: false,
                description: 'Foo',
              },
            },
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should validate endpoint', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-connector',
            name: 'New Connector',
            purpose: 'This is a new connector',
            endpoint: 'https://www.example.com1',
            method: 'post',
            payload: {
              param: {
                type: 'number',
                required: false,
                description: 'Foo',
              },
            },
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should validate payload type', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/datasources/${factory.datasource.resId}/connectors`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-connector',
            name: 'New Connector',
            purpose: 'This is a new connector',
            endpoint: 'https://www.example.com',
            method: 'post',
            payload: {
              param: {
                type: 'invalid',
                required: false,
                description: 'Foo',
              },
            },
            metadata: { key: 'value' },
          },
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/datasources/non-existent/connectors')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'non-existent-connector',
            name: 'Non-existent Connector',
            purpose: 'This is a non-existent connector',
            endpoint: 'https://api.non-existent-connector.com',
            method: 'post',
            payload: {},
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /datasources/:datasource_id/connectors/:connector_id', () => {
    it('should get a connector by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/connectors/${factory.connector.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toMatchObject({
        id: factory.connector.resId,
        name: factory.connector.name,
      });
    });

    it('should handle connector not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${factory.datasource.resId}/connectors/non-existent`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources/non-existent/connectors/connector-id')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /datasources/:datasource_id/connectors/:connector_id', () => {
    it('should delete a connector by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/datasources/${factory.datasource.resId}/connectors/${factory.connector.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      const model = await db.Connector.findOne({
        where: {
          resId: factory.connector.resId,
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).toBeNull();
    });

    it('should handle connector not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/datasources/${factory.datasource.resId}/connectors/non-existent`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle datasource not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/datasources/non-existent/connectors/connector-id')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
