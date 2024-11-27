const nconf = require('nconf');
const _ = require('lodash');

function convertToAppropriateType(value) {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  const parsedNumber = Number(value);
  if (!Number.isNaN(parsedNumber)) {
    return parsedNumber;
  }

  return value;
}

function getEnvironment(envVar, defValue = '') {
  if (_.isUndefined(process.env[envVar])) {
    return defValue;
  }
  return convertToAppropriateType(process.env[envVar]);
}

// ---------------------------------------------

nconf.use('memory');

nconf.set('app:host', getEnvironment('DATARAG_HOST', 'http://localhost:4100'));

// Prefix namespace for registry in Redis. Modify if you want to separate
// data, between multiple environments (e.g. beta, staging) that are using
// the same Redis instance, e.g.
nconf.set('registry:prefix', getEnvironment('DATARAG_REGISTRY_PREFIX', 'prod'));

// Sentry
nconf.set('sentry:dsn', getEnvironment('DATARAG_SENTRY_DSN'));

// LLMs
nconf.set('secrets:openai_api_key', getEnvironment('DATARAG_OPENAI_API_KEY'));
nconf.set('secrets:cohere_api_key', getEnvironment('DATARAG_COHERE_API_KEY'));
nconf.set('secrets:api_token_salt', getEnvironment('DATARAG_API_TOKEN_SALT'));

// Queue
nconf.set('queue:name', getEnvironment('DATARAG_QUEUE_NAME', 'index'));
nconf.set('queue:workers', getEnvironment('DATARAG_QUEUE_WORKERS', 2));

nconf.set('api:payload:maxsize', getEnvironment('DATARAG_API_PAYLOAD_MAXSIZE', '50mb'));

nconf.set('retrieval:embeddings:cutoff', getEnvironment('DATARAG_RETRIEVAL_EMBEDDINGS_CUTOFF', 0.5));
nconf.set('retrieval:rerank:cutoff', getEnvironment('DATARAG_RETRIEVAL_RERANK_CUTOFF', 0.5));
nconf.set('chat:turns:maxtokens', getEnvironment('DATARAG_CHAT_TURNS_MAXTOKENS', 4096));
nconf.set('chat:instructions:maxtokens', getEnvironment('DATARAG_CHAT_INSTRUCTIONS_MAXTOKENS', 2048));
nconf.set('chat:custom:context:maxtokens', getEnvironment('DATARAG_CHAT_CUSTOM_CONTEXT_MAXTOKENS', 16384));

// Logs
nconf.set('auditlog:enabled', getEnvironment('DATARAG_AUDITLOG_ENABLED', true));
nconf.set('costlog:enabled', getEnvironment('DATARAG_COSTLOG_ENABLED', true));
nconf.set('raglog:enabled', getEnvironment('DATARAG_RAGLOG_ENABLED', true));
nconf.set('raglog:retentiondays', getEnvironment('DATARAG_RAGLOG_RETENTIONDAYS', 3));

// LLM costs
nconf.set('llm:pricing', {
  // OpenAI per token pricing
  'gpt-4o-mini': {
    input: 0.15 / 1000000,
    output: 0.6 / 1000000,
  },
  'gpt-4o': {
    input: 2.5 / 1000000,
    output: 10 / 1000000,
  },
  'gpt-4-turbo': {
    input: 10 / 1000000,
    output: 30 / 1000000,
  },
  'gpt-3.5-turbo': {
    input: 0.5 / 1000000,
    output: 1.5 / 1000000,
  },
  'gpt-4': {
    input: 30 / 1000000,
    output: 60 / 1000000,
  },
  // Cohere per token pricing
  'embed-multilingual-v3.0': {
    input: 0.1 / 1000000,
    output: 0,
  },
  'rerank-multilingual-v3.0': {
    input: 2 / 1000, // per search price
    output: 0,
  },
  'command-r-plus': {
    input: 2.5 / 1000000,
    output: 10 / 1000000,
  },
  'command-r': {
    input: 0.15 / 1000000,
    output: 0.6 / 1000000,
  },
});

// Validate
if (process.env.NODE_ENV === 'production') {
  if (!nconf.get('secrets:openai_api_key')) {
    throw new Error('Please set DATARAG_OPENAI_API_KEY environment variable');
  }
  if (!nconf.get('secrets:cohere_api_key')) {
    throw new Error('Please set DATARAG_COHERE_API_KEY environment variable');
  }
  if (!nconf.get('secrets:api_token_salt')) {
    throw new Error('Please set DATARAG_API_TOKEN_SALT environment variable');
  }
}

module.exports = nconf;
