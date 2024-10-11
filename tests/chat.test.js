const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const { SCOPE_CHAT } = require('../src/scopes');
const { chatStream } = require('../src/llms/openai');
const { getCannedResponse } = require('../src/helpers/cannedResponse');

jest.mock('../src/llms/openai');
jest.mock('../src/helpers/cannedResponse');

const TOKEN = 'org_chat_token';

describe('Chat API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
  });

  describe('POST /chat', () => {
    it('should process a valid chat request and return a response', async () => {
      const agent = supertest.agent(app);

      chatStream.mockResolvedValue({
        text: 'Machine learning is a subset of AI.',
        model: 'gpt-4o',
        costUSD: 0.001,
        chatHistory: [{ role: 'user', content: 'What is machine learning?' }],
      });

      const res = await agent
        .post('/v1/chat')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual('Machine learning is a subset of AI.');
      expect(res.body.meta).toMatchObject({
        query: 'What is machine learning?',
        model: 'gpt-4o',
      });
    });

    it('should stream responses when stream is set to true', async () => {
      const agent = supertest.agent(app);

      chatStream.mockImplementation(async ({ streamFn }) => {
        await streamFn('Machine');
        await streamFn(' learning is');
        await streamFn(' a subset of AI.');
        return {
          text: 'Machine learning is a subset of AI.',
          model: 'gpt-4o',
          costUSD: 0.001,
          chatHistory: [{ role: 'user', content: 'What is machine learning?' }],
        };
      });

      const res = await agent
        .post('/v1/chat')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
            stream: true,
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Machine');
      expect(res.text).toContain(' learning is');
      expect(res.text).toContain(' a subset of AI.');
    });

    it('should return a 400 error if no query is provided', async () => {
      const agent = supertest.agent(app);

      const res = await agent
        .post('/v1/chat')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            instructions: 'You are a helpful assistant',
          },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        errors: [{
          errorCode: 'required.openapi.validation',
          message: 'must have required property \'query\'',
          path: '/body/data/query',
        }],
        message: 'request/body/data must have required property \'query\'',
      });
    });

    it('should fallback to a canned response if no data is found', async () => {
      const agent = supertest.agent(app);

      getCannedResponse.mockReturnValue('Sorry, I could not find the information you are looking for.');

      chatStream.mockResolvedValue({
        text: '',
        model: 'gpt-4o',
        costUSD: 0.001,
        chatHistory: [],
      });

      const res = await agent
        .post('/v1/chat')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            query: 'What is the answer to life?',
            datasource_ids: [factory.datasource.resId],
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual('Sorry, I could not find the information you are looking for.');
    });

    it('should return 401 error for unauthorized access', async () => {
      const agent = supertest.agent(app);

      const res = await agent
        .post('/v1/chat')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          data: {
            query: 'What is machine learning?',
          },
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({
        errors: ['Authentication credentials are missing'],
        message: 'Unauthorized',
      });
    });
  });
});
