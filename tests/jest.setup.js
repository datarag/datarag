require('events').EventEmitter.defaultMaxListeners = 0;

jest.mock('../src/llms/cohere', () => ({
  createEmbeddings: jest.fn(async ({ texts }) => {
    function range(start, end, step = 1) {
      const result = [];
      for (let i = start; (step > 0 ? i < end : i > end); i += step) {
        result.push(i);
      }
      return result;
    }
    return {
      embeddings: (texts || []).map(() => range(0, 1024)),
      costUSD: 0,
    };
  }),

  rerank: jest.fn(async ({ chunks }) => {
    return {
      chunks,
      costUSD: 0,
    };
  }),

  inference: jest.fn(async ({ text, json }) => {
    return {
      model: 'gpt',
      output: json ? {} : text,
      costUSD: 0,
    };
  }),
}));

jest.mock('../src/llms/openai', () => ({
  inference: jest.fn(async ({ text, json }) => {
    return {
      model: 'gpt',
      output: json ? {} : text,
      costUSD: 0,
    };
  }),

  textToTokens: jest.fn((text) => {
    return (text || '').split(' ');
  }),

  tokensToText: jest.fn((tokens) => {
    return (tokens || []).join(' ');
  }),

  chatStream: jest.fn(async ({ messages }) => {
    return {
      model: 'gpt',
      costUSD: 0,
      text: 'Hello',
      messages,
    };
  }),
}));
