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
nconf.set('prompt:caching:sec', getEnvironment('DATARAG_PROMPT_CACHING_SEC', 3600)); // 1 hour

nconf.set('retrieval:embeddings:threshold', getEnvironment('DATARAG_RETRIEVAL_EMBEDDINGS_THRESHOLD', 0.5));
nconf.set('retrieval:rerank:threshold', getEnvironment('DATARAG_RETRIEVAL_EMBEDDINGS_THRESHOLD', 0.2));

// Logs
nconf.set('auditlog:enabled', getEnvironment('DATARAG_AUDITLOG_ENABLED', true));
nconf.set('raglog:enabled', getEnvironment('DATARAG_RAGLOG_ENABLED', true));
nconf.set('costlog:enabled', getEnvironment('DATARAG_COSTLOG_ENABLED', true));
nconf.set('raglog:retentiondays', getEnvironment('DATARAG_RAGLOG_RETENTIONDAYS', 14));

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
