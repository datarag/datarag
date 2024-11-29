const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const db = require('../src/db/models'); // Ensure you import your database models
const { SCOPE_CHAT } = require('../src/scopes');

const TOKEN = 'org1';
const OTHER_TOKEN = 'other';

describe('Conversations API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });

    await setupOrg(OTHER_TOKEN);
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
    await tearDownOrg(OTHER_TOKEN);
  });

  describe('GET /conversations', () => {
    it('should list all conversations', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/conversations')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual([
        {
          id: factory.conversation.resId,
          title: TOKEN,
          date: res.body.data[0].date,
        },
      ]);
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/conversations')
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('GET /conversations/:conversation_id', () => {
    it('should retrieve a specific conversation by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: factory.conversation.resId,
        title: TOKEN,
        date: res.body.data.date,
      });
    });

    it('should return 404 for a non-existent conversation id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/conversations/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('DELETE /conversations/:conversation_id', () => {
    it('should delete a conversation by id', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      const model = await db.Conversation.findOne({
        where: {
          resId: factory.conversation.resId,
          OrganizationId: factory.organization.id,
        },
      });
      expect(model).toBeNull();
    });

    it('should return 404 for deleting a non-existent conversation', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/conversations/non-existent')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('GET /conversations/:conversation_id/turns', () => {
    it('should retrieve the turns of a specific conversation', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${factory.conversation.resId}/turns`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual(factory.conversation.history.turns);
    });

    it('should return 404 for a non-existent conversation', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get('/v1/conversations/non-existent/turns')
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        errors: ['Resource may have been deleted or not been created yet'],
        message: 'Not found',
      });
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${factory.conversation.resId}/turns`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should return an empty array if the conversation has no turns', async () => {
      // Creating a conversation with no turns
      const emptyConversation = await db.Conversation.create({
        OrganizationId: factory.organization.id,
        ApiKeyId: factory.apiKey.id,
        resId: 'empty-conversation',
        history: { provider: 'gpt', turns: [] },
      });

      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${emptyConversation.resId}/turns`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
