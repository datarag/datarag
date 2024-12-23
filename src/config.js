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

// API encryption salt
nconf.set('secrets:api_token_salt', getEnvironment('DATARAG_API_TOKEN_SALT'));

// Queue
nconf.set('queue:name', getEnvironment('DATARAG_QUEUE_NAME', 'index'));
nconf.set('queue:workers', getEnvironment('DATARAG_QUEUE_WORKERS', 2));

// Express body upload size
nconf.set('api:payload:maxsize', getEnvironment('DATARAG_API_PAYLOAD_MAXSIZE', '50mb'));

// Vector cosine distance cutoff during semantic search
nconf.set('retrieval:embeddings:cutoff', getEnvironment('DATARAG_RETRIEVAL_EMBEDDINGS_CUTOFF', 0.5));

// Rerank score cutoff value
nconf.set('retrieval:rerank:cutoff', getEnvironment('DATARAG_RETRIEVAL_RERANK_CUTOFF', 0.5));

// Max tokens to use when embedding conversation history in chat
nconf.set('chat:history:maxtokens', getEnvironment('DATARAG_CHAT_HISTORY_MAXTOKENS', 512));

// Max tokens to use when adding custom instructions in chat
nconf.set('chat:instructions:maxtokens', getEnvironment('DATARAG_CHAT_INSTRUCTIONS_MAXTOKENS', 1024));

// Max tokens to use when adding custom turn context in chat (outside RAG)
nconf.set('chat:turn:context:maxtokens', getEnvironment('DATARAG_CHAT_TURN_CONTEXT_MAXTOKENS', 16384));

// Max conversation history size
nconf.set('chat:max:conversations', getEnvironment('DATARAG_CHAT_MAX_CONVERSATIONS', 100));

// Max conversation turns per conversation
nconf.set('chat:max:turns', getEnvironment('DATARAG_CHAT_MAX_TURNS', 100));

// Logs
nconf.set('auditlog:enabled', getEnvironment('DATARAG_AUDITLOG_ENABLED', true));
nconf.set('costlog:enabled', getEnvironment('DATARAG_COSTLOG_ENABLED', true));
nconf.set('raglog:enabled', getEnvironment('DATARAG_RAGLOG_ENABLED', true));
nconf.set('raglog:retentiondays', getEnvironment('DATARAG_RAGLOG_RETENTIONDAYS', 3));

// Embeddings cache retention
nconf.set('embeddings:retentiondays', getEnvironment('DATARAG_EMBEDDINGS_RETENTIONDAYS', 60));

// RAG content hash salt
nconf.set('rag:content:salt', getEnvironment('DATARAG_RAG_CONTENT_SALT', 'v1'));

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
