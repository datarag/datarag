const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const db = require('../src/db/models'); // Ensure you import your database models
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Agent API', () => {
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

  describe('GET /agents', () => {
    it('should list all agents', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        data: [{
          id: TOKEN,
          name: TOKEN,
          purpose: TOKEN,
          date: res.body.data[0].date,
        }],
      });
    });

    it('should handle authentication error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/agents')
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should handle api scope error', async () => {
      await factory.apiKey.update({ scopes: 'data:write' });
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Invalid API scopes'],
        message: 'Unauthorized',
      });
    });
  });

  describe('POST /agents', () => {
    it('should create a new agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'new-agent',
            name: 'New Agent',
            purpose: 'A new agent purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: 'new-agent',
        name: 'New Agent',
        purpose: 'A new agent purpose',
        date: res.body.data.date,
      });

      const model = await db.Agent.findOne({
        where: {
          resId: 'new-agent',
          OrganizationId: factory.organization.id,
        },
      });
      expect(model).not.toBeNull();
    });

    it('should handle conflict when creating a agent with an existing id', async () => {
      const agent = supertest.agent(app);
      await agent
        .post('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'conflict-agent',
            name: 'Conflict Agent',
            purpose: 'A conflict agent purpose',
          },
        });

      const res = await agent
        .post('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'conflict-agent',
            name: 'Another Agent',
            purpose: 'Another purpose',
          },
        });

      expect(res.statusCode).toEqual(409);
    });
  });

  describe('GET /agents/:id', () => {
    it('should get a agent by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: TOKEN,
        purpose: TOKEN,
        date: res.body.data.date,
      });
    });

    it('should handle not found error', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/agents/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /agents/:id', () => {
    it('should update a agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Updated Agent',
            purpose: 'An updated agent purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: 'Updated Agent',
        purpose: 'An updated agent purpose',
        date: res.body.data.date,
      });

      const model = await db.Agent.findOne({
        where: {
          resId: TOKEN,
          OrganizationId: factory.organization.id,
        },
      });
      expect(model.name).toEqual('Updated Agent');
      expect(model.purpose).toEqual('An updated agent purpose');
    });

    it('should update a agent name', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Updated Agent',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: 'Updated Agent',
        purpose: factory.agent.purpose,
        date: res.body.data.date,
      });
    });

    it('should update a agent purpose', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            purpose: 'Updated purpose',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: TOKEN,
        name: factory.agent.name,
        purpose: 'Updated purpose',
        date: res.body.data.date,
      });
    });

    it('should validate payload', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put(`/v1/agents/${TOKEN}`)
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
        .post('/v1/agents')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-agent',
            name: 'Existing Agent',
            purpose: 'An existing agent purpose',
          },
        });

      const res = await agent
        .put(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            id: 'existing-agent',
            name: 'Updated Agent',
            purpose: 'An updated agent purpose',
          },
        });

      expect(res.statusCode).toEqual(409);
    });

    it('should handle not found error when updating', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .put('/v1/agents/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            name: 'Non-existent Agent',
            purpose: 'A non-existent agent purpose',
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('should delete a datasource by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/agents/${TOKEN}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      const model = await db.Agent.findOne({
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
        .delete('/v1/agents/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /agents/:id/datasources', () => {
    it('should list all datasources in an agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        data: [{
          id: TOKEN,
          name: TOKEN,
          purpose: TOKEN,
          date: res.body.data[0].date,
        }],
      });
    });

    it('should handle not found error when listing datasources of a non-existent agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/agents/non-existent/datasources')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /agents/:id/datasources', () => {
    it('should add a datasource to an agent', async () => {
      await factory.agentDatasource.destroy();

      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: TOKEN,
            },
          },
        });

      expect(res.statusCode).toEqual(204);

      const model = await db.AgentDatasource.findOne({
        where: {
          AgentId: factory.agent.id,
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).not.toBeNull();
    });

    it('should add a datasource to an agent (existing)', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: TOKEN,
            },
          },
        });

      expect(res.statusCode).toEqual(204);

      const model = await db.AgentDatasource.findOne({
        where: {
          AgentId: factory.agent.id,
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).not.toBeNull();
    });

    it('should handle not found error when adding a datasource to a non-existent agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post('/v1/agents/non-existent/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: TOKEN,
            },
          },
        });

      expect(res.statusCode).toEqual(404);
    });

    it('should handle not found error when adding a non-existent datasource to an agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .post(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: 'non-existent-datasource',
            },
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /agents/:id/datasources', () => {
    it('should remove a datasource from an agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: TOKEN,
            },
          },
        });

      expect(res.statusCode).toEqual(204);

      const model = await db.AgentDatasource.findOne({
        where: {
          AgentId: factory.agent.id,
          DatasourceId: factory.datasource.id,
        },
      });
      expect(model).toBeNull();
    });

    it('should handle not found error when removing a datasource from a non-existent agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/agents/non-existent/datasources')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: TOKEN,
            },
          },
        });

      expect(res.statusCode).toEqual(404);
    });

    it('should handle not found error when removing a non-existent datasource from an agent', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/agents/${TOKEN}/datasources`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            datasource: {
              id: 'non-existent-datasource',
            },
          },
        });

      expect(res.statusCode).toEqual(404);
    });
  });
});
