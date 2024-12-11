const fs = require('fs');
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
      expect(res.body.data).toEqual([{
        id: factory.turn.resId,
        tokens: factory.turn.tokens,
        metadata: {},
        payload: {
          data: {
            message: TOKEN,
          },
          meta: {
            transaction_id: TOKEN,
          },
        },
        date: res.body.data[0].date,
      }]);
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
      });

      const agent = supertest.agent(app);
      const res = await agent
        .get(`/v1/conversations/${emptyConversation.resId}/turns`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /conversations', () => {
    it('should create a new conversation with a provided ID', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          id: 'custom-id',
          title: 'Custom Conversation',
        },
      };

      const res = await agent
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        id: 'custom-id',
        title: 'Custom Conversation',
        date: res.body.data.date,
      });

      const createdConversation = await db.Conversation.findOne({
        where: { resId: 'custom-id' },
      });
      expect(createdConversation).not.toBeNull();
      expect(createdConversation.title).toEqual('Custom Conversation');
    });

    it('should auto-generate an ID if not provided', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          title: 'Generated Conversation',
        },
      };

      const res = await agent
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toMatch(/^conv-/); // Check that ID starts with 'conv-'
      expect(res.body.data.title).toEqual('Generated Conversation');

      const createdConversation = await db.Conversation.findOne({
        where: { resId: res.body.data.id },
      });
      expect(createdConversation).not.toBeNull();
    });

    it('should handle data as optional', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {},
      };

      const res = await agent
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toMatch(/^conv-/); // Check that ID starts with 'conv-'
      expect(res.body.data.title).toEqual('');

      const createdConversation = await db.Conversation.findOne({
        where: { resId: res.body.data.id },
      });
      expect(createdConversation).not.toBeNull();
    });

    it('should return 409 if a conversation with the same ID exists', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          id: factory.conversation.resId,
        },
      };

      const res = await agent
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(409);
      expect(res.body).toEqual({
        errors: ['A resource with the same id already exists'],
        message: 'Conflict',
      });
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          id: 'unauthorized-id',
          title: 'Unauthorized Conversation',
        },
      };

      const res = await agent
        .post('/v1/conversations')
        .set('Authorization', 'Bearer invalid')
        .send(payload);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('PUT /conversations/:conversation_id', () => {
    it('should update a conversation by its ID', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          title: 'Updated Conversation Title',
        },
      };

      const res = await agent
        .put(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.title).toEqual('Updated Conversation Title');

      const updatedConversation = await db.Conversation.findOne({
        where: { resId: factory.conversation.resId },
      });
      expect(updatedConversation.title).toEqual('Updated Conversation Title');
    });

    it('should allow updating the conversation ID', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          id: 'new-conversation-id',
        },
      };

      const res = await agent
        .put(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toEqual('new-conversation-id');

      const updatedConversation = await db.Conversation.findOne({
        where: { resId: 'new-conversation-id' },
      });
      expect(updatedConversation).not.toBeNull();
    });

    it('should return 409 if updating to an existing conversation ID', async () => {
      const agent = supertest.agent(app);

      // Create another conversation to conflict with
      await db.Conversation.create({
        OrganizationId: factory.organization.id,
        ApiKeyId: factory.apiKey.id,
        resId: 'existing-id',
      });

      const payload = {
        data: {
          id: 'existing-id',
        },
      };

      const res = await agent
        .put(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(409);
      expect(res.body).toEqual({
        errors: ['A resource with the same id already exists'],
        message: 'Conflict',
      });
    });

    it('should return 404 for a non-existent conversation', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          title: 'Non-existent Conversation',
        },
      };

      const res = await agent
        .put('/v1/conversations/non-existent-id')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        errors: ['Resource may have been deleted or not been created yet'],
        message: 'Not found',
      });
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          title: 'Unauthorized Update',
        },
      };

      const res = await agent
        .put(`/v1/conversations/${factory.conversation.resId}`)
        .set('Authorization', 'Bearer invalid')
        .send(payload);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('POST /conversations/:conversation_id/train', () => {
    it('should train a conversation with a text document', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'text',
          content: 'This is the content of a text document.',
          metadata: { key: 'value' },
        },
      };

      const res = await agent
        .post(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(204);

      const datasource = await db.Datasource.findOne({
        where: { ConversationId: factory.conversation.id },
      });
      expect(datasource).not.toBeNull();

      const document = await db.Document.findOne({
        where: {
          DatasourceId: datasource.id,
        },
      });
      expect(document).not.toBeNull();
      expect(document.content).toEqual('This is the content of a text document.');
    });

    it('should train a conversation with a markdown document', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'markdown',
          content: '# Hello World',
          metadata: { key: 'value' },
        },
      };

      const res = await agent
        .post(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(204);

      const datasource = await db.Datasource.findOne({
        where: { ConversationId: factory.conversation.id },
      });
      expect(datasource).not.toBeNull();

      const document = await db.Document.findOne({
        where: { DatasourceId: datasource.id },
      });
      expect(document).not.toBeNull();
      expect(document.content).toEqual('# Hello World');
    });

    it('should train a conversation with a PDF document', async () => {
      const binaryData = fs.readFileSync(`${__dirname}/helloworld.pdf`);
      const base64String = binaryData.toString('base64');

      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'pdf',
          content: base64String,
          metadata: { key: 'value' },
        },
      };

      const res = await agent
        .post(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(204);

      const datasource = await db.Datasource.findOne({
        where: { ConversationId: factory.conversation.id },
      });
      expect(datasource).not.toBeNull();

      const document = await db.Document.findOne({
        where: { DatasourceId: datasource.id },
      });
      expect(document).not.toBeNull();
      expect(document.content).toEqual('Hello, world!');
    });

    it('should handle invalid document content type', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'unsupported',
          content: 'Invalid content type.',
        },
      };

      const res = await agent
        .post(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 if the conversation does not exist', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'text',
          content: 'This is the content of a text document.',
        },
      };

      const res = await agent
        .post('/v1/conversations/non-existent/train')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        errors: ['Resource may have been deleted or not been created yet'],
        message: 'Not found',
      });
    });

    it('should handle unauthorized access', async () => {
      const agent = supertest.agent(app);
      const payload = {
        data: {
          type: 'text',
          content: 'Unauthorized content.',
        },
      };

      const res = await agent
        .post(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', 'Bearer invalid')
        .send(payload);

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });

  describe('DELETE /v1/conversations/:conversation_id/train', () => {
    it('should delete conversation training data', async () => {
      const datasource = await db.Datasource.create({
        ConversationId: factory.conversation.id,
        OrganizationId: factory.organization.id,
        resId: 'any',
        name: 'foo',
        purpose: 'bar',
      });

      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      // Verify datasource is deleted
      const deletedDatasource = await db.Datasource.findOne({ where: { id: datasource.id } });
      expect(deletedDatasource).toBeNull();
    });

    it('should return 404 for a non-existent conversation', async () => {
      const agent = supertest.agent(app);
      const res = await agent
        .delete('/v1/conversations/non-existent/train')
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
        .delete(`/v1/conversations/${factory.conversation.resId}/train`)
        .set('Authorization', 'Bearer invalid');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });

    it('should handle a conversation with no training data gracefully', async () => {
      const conversation = await db.Conversation.create({
        OrganizationId: factory.organization.id,
        ApiKeyId: factory.apiKey.id,
        resId: 'conversation-no-training',
      });

      const agent = supertest.agent(app);
      const res = await agent
        .delete(`/v1/conversations/${conversation.resId}/train`)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.statusCode).toEqual(204);

      // No datasources should exist for this conversation
      const datasources = await db.Datasource.findAll({
        where: { ConversationId: conversation.id },
      });
      expect(datasources).toHaveLength(0);
    });
  });
});
