const supertest = require('supertest');
const { app } = require('../src/server');
const { setupOrg, tearDownOrg } = require('./factory');
const { SCOPE_CHAT } = require('../src/scopes');
const openai = require('../src/llms/openai');
const cohere = require('../src/llms/cohere');

jest.mock('../src/llms/openai');
jest.mock('../src/llms/cohere');

const TOKEN = 'org_chat_token';

describe('Inference API', () => {
  let factory;

  beforeEach(async () => {
    factory = await setupOrg(TOKEN);
    await factory.apiKey.update({ scopes: `${SCOPE_CHAT}` });
  });

  afterEach(async () => {
    await tearDownOrg(TOKEN);
  });

  describe('POST /inference', () => {
    it('should process a valid inference request', async () => {
      const agent = supertest.agent(app);

      openai.inference.mockResolvedValue({
        output: 'Machine learning is a subset of AI.',
        model: 'gpt-4o',
        costUSD: 0.001,
      });

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
            creativity: 'low',
            quality: 'high',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual('Machine learning is a subset of AI.');
      expect(res.body.meta).toMatchObject({
        prompt: 'What is machine learning?',
        model: 'gpt-4o',
      });
    });

    it('should process a valid inference request in JSON mode (prompt)', async () => {
      const agent = supertest.agent(app);

      openai.inference.mockResolvedValue({
        output: { foo: 'bar' },
        model: 'gpt-4o',
        costUSD: 0.001,
      });

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning? Respond in JSON.',
            instructions: 'You are a helpful assistant',
            creativity: 'low',
            quality: 'high',
            json: true,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual({ foo: 'bar' });
    });

    it('should process a valid inference request in JSON mode (instructions)', async () => {
      const agent = supertest.agent(app);

      openai.inference.mockResolvedValue({
        output: { foo: 'bar' },
        model: 'gpt-4o',
        costUSD: 0.001,
      });

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant. Respond in JSON.',
            creativity: 'low',
            quality: 'high',
            json: true,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual({ foo: 'bar' });
    });

    it('should fallback to cohere if openai fails', async () => {
      const agent = supertest.agent(app);

      openai.inference.mockRejectedValue(new Error('Model unavailable'));
      cohere.inference.mockResolvedValue({
        output: 'Machine learning involves using algorithms.',
        model: 'cohere',
        costUSD: 0.002,
      });

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.message).toEqual('Machine learning involves using algorithms.');
      expect(res.body.meta).toMatchObject({
        prompt: 'What is machine learning?',
        model: 'cohere',
      });
    });

    it('should apply default values for creativity and quality', async () => {
      const agent = supertest.agent(app);

      openai.inference.mockResolvedValue({
        output: 'Machine learning is a subset of AI.',
        model: 'gpt-4o',
        costUSD: 0.001,
      });

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(openai.inference).toHaveBeenCalledWith(expect.objectContaining({
        creativity: 'low', // Default value
        quality: 'high', // Default value
      }));
    });

    it('should return 400 error for missing prompt field', async () => {
      const agent = supertest.agent(app);

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            instructions: 'You are a helpful assistant',
            creativity: 'medium',
            quality: 'high',
          },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        errors: [{
          errorCode: 'required.openapi.validation',
          message: 'must have required property \'prompt\'',
          path: '/body/data/prompt',
        }],
        message: 'request/body/data must have required property \'prompt\'',
      });
    });

    it('should return 400 error for invalid json reply', async () => {
      const agent = supertest.agent(app);

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
            json: true,
          },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        errors: ['The message should contain the word JSON'],
        message: 'Bad request',
      });
    });

    it('should return 401 error for unauthorized access', async () => {
      const agent = supertest.agent(app);

      const res = await agent
        .post('/v1/inference')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          data: {
            prompt: 'What is machine learning?',
            instructions: 'You are a helpful assistant',
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
