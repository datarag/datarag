const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const db = require('../src/db/models'); // Ensure you import your database models
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Datasources API', () => {
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

  describe('GET /datasources', () => {
    it('should list all datasources', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        data: [{
          id: TOKEN,
          name: TOKEN,
          purpose: TOKEN,
        }],
      });
    });

    it('should handle authentication error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources')
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
        .get('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toMatchObject({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });
  });

  describe('POST /datasources', () => {
    it('should create a new datasource', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-datasource',
            name: 'New Datasource',
            purpose: 'A new datasource purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: 'new-datasource',
        name: 'New Datasource',
        purpose: 'A new datasource purpose',
      });

      const model = await db.Datasource.findOne({
        where: {
          resId: 'new-datasource',
          OrganizationId: factory.organization.id,
        },
      });
      expect(model).not.toBeNull();
    });

    it('should handle conflict when creating a datasource with an existing id', async () => {
      const agent = supertest.agent(app);
      await agent
        .post('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'conflict-datasource',
            name: 'Conflict Datasource',
            purpose: 'A conflict datasource purpose',
          },
        });

      const res = await agent
        .post('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'conflict-datasource',
            name: 'Another Datasource',
            purpose: 'Another purpose',
          },
        });

      expect(res.statusCode).toEqual(409);
    });
  });

  describe('GET /datasources/:id', () => {
    it('should get a datasource by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: TOKEN,
        purpose: TOKEN,
      });
    });

    it('should handle not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/datasources/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /datasources/:id', () => {
    it('should update a datasource', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Updated Datasource',
            purpose: 'An updated datasource purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: 'Updated Datasource',
        purpose: 'An updated datasource purpose',
      });

      const model = await db.Datasource.findOne({
        where: {
          resId: TOKEN,
          OrganizationId: factory.organization.id,
        },
      });
      expect(model.name).toEqual('Updated Datasource');
      expect(model.purpose).toEqual('An updated datasource purpose');
    });

    it('should update a datasource name', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Updated Datasource',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: 'Updated Datasource',
        purpose: factory.datasource.purpose,
      });
    });

    it('should update a datasource purpose', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            purpose: 'Updated purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: factory.datasource.name,
        purpose: 'Updated purpose',
      });
    });

    it('should validate payload', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'invalid id passed',
          },
        });
      expect(res.statusCode).toEqual(400);
    });

    it('should handle conflict when updating with an existing id', async () => {
      const agent = supertest.agent(app);
      await agent
        .post('/v1/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-datasource',
            name: 'Existing Datasource',
            purpose: 'An existing datasource purpose',
          },
        });

      const res = await agent
        .put(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-datasource',
            name: 'Updated Datasource',
            purpose: 'An updated datasource purpose',
          },
        });

      expect(res.statusCode).toEqual(409);
    });

    it('should handle not found error when updating', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put('/v1/datasources/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Non-existent Datasource',
            purpose: 'A non-existent datasource purpose',
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /datasources/:id', () => {
    it('should delete a datasource by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/datasources/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      const model = await db.Datasource.findOne({
        where: {
          resId: TOKEN,
          OrganizationId: factory.organization.id,
        },
      });
      expect(model).toBeNull();
    });

    it('should handle not found error when deleting', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/datasources/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
