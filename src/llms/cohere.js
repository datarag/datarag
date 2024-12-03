/* eslint-disable no-param-reassign */
const _ = require('lodash');
const { CohereClient, CohereClientV2 } = require('cohere-ai');
const config = require('../config');
const logger = require('../logger');
const {
  LLM_CREATIVITY_HIGH,
  LLM_CREATIVITY_MEDIUM,
  LLM_CREATIVITY_LOW,
  LLM_CREATIVITY_NONE,
  LLM_QUALITY_HIGH,
  LLM_QUALITY_MEDIUM,
} = require('../constants');

const COHERE_EMBEDDINGS_MODEL = 'embed-multilingual-v3.0';
const COHERE_RERANK_MODEL = 'rerank-multilingual-v3.0';
const COHERE_INFERENCE_MODEL_HIGH = 'command-r-plus';
const COHERE_INFERENCE_MODEL_MED = 'command-r';

const COHERE_CLIENT_CONFIG = {
  token: config.get('secrets:cohere_api_key'),
};
const COHERE_CLIENT_REQUEST_OPTIONS = {
  timeoutInSeconds: 60,
};

const MAX_RETRIES = 10;

/**
 * Get the model used for embeddings generation
 *
 * @return {String}
 */
function getEmbeddingsModel() {
  return COHERE_EMBEDDINGS_MODEL;
}

/**
 * Create embeddings over a set of texts for document or query use
 *
 * @param {*} { texts, type }
 * @return {*}
 */
async function createEmbeddings({ texts, type }) {
  if (_.isEmpty(texts)) {
    return {
      embeddings: [],
      costUSD: 0,
    };
  }

  const cohere = new CohereClient(COHERE_CLIENT_CONFIG);

  let inputType;
  switch (type) {
    case 'document':
      inputType = 'search_document';
      break;
    case 'query':
      inputType = 'search_query';
      break;
    default:
      throw new Error('Invalid embeddings type');
  }

  let tokens = 0;
  const embeddings = [];
  const chunks = _.chunk(texts, 96);

  for (let i = 0; i < chunks.length; i += 1) {
    let attempt = 0;
    let success = false;
    while (attempt < MAX_RETRIES && !success) {
      try {
        const response = await cohere.embed({
          texts: chunks[i],
          model: COHERE_EMBEDDINGS_MODEL,
          inputType,
        }, COHERE_CLIENT_REQUEST_OPTIONS);
        tokens += (
          response.meta.billedUnits.inputTokens || 0
        ) + (
          response.meta.billedUnits.outputTokens || 0
        );
        embeddings.push(...response.embeddings);
        success = true;
      } catch (err) {
        attempt += 1;
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1000;
          await new Promise((resolve) => { setTimeout(resolve, delay); });
        } else {
          logger.error('createEmbeddings', err);
          throw err;
        }
      }
    }
  }

  if (embeddings.length !== texts.length) {
    throw new Error('Embeddings failed');
  }

  const response = {
    costUSD: tokens * config.get(`llm:pricing:${COHERE_EMBEDDINGS_MODEL}:input`),
    embeddings,
  };

  return response;
}

/**
 * Perform reranking on a set of chunks
 *
 * @param {*} { query, chunks, bias }
 * @return {*}
 */
async function rerank({ query, chunks, cutoff }) {
  if (_.isEmpty(chunks)) {
    return {
      chunks,
      costUSD: 0,
    };
  }

  const cohere = new CohereClient(COHERE_CLIENT_CONFIG);

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const rerankResponse = await cohere.rerank({
        documents: _.map(chunks, (chunk) => ({
          id: chunk.id,
          text: chunk.content,
        })),
        return_documents: false,
        query,
        model: COHERE_RERANK_MODEL,
      }, COHERE_CLIENT_REQUEST_OPTIONS);

      const filteredChunks = [];
      const sortedChunks = [];
      _.each(rerankResponse.results, (result) => {
        const chunk = chunks[result.index];
        chunk.score = result.relevanceScore;
        sortedChunks.push(chunk);
        if (result.relevanceScore >= cutoff) {
          filteredChunks.push(chunk);
        }
      });

      const response = {
        costUSD: config.get(`llm:pricing:${COHERE_RERANK_MODEL}:input`),
        chunks: _.isEmpty(filteredChunks) ? sortedChunks : filteredChunks,
      };

      return response;
    } catch (err) {
      attempt += 1;
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 1000;
        await new Promise((resolve) => { setTimeout(resolve, delay); });
      } else {
        logger.error('rerank', err);
        throw err;
      }
    }
  }

  throw new Error('Could not rerank');
}

/**
 * Raw prompt over LLM
 *
 * @param {*} { text, instructions, creativity, quality, json }
 * @return {*}
 */
async function inference({
  text, instructions, creativity, quality, json,
}) {
  const cohere = new CohereClientV2(COHERE_CLIENT_CONFIG);

  // Prepare messages
  const messages = [];
  if (instructions) {
    messages.push({
      role: 'system',
      content: instructions,
    });
  }
  messages.push({
    role: 'user',
    content: text,
  });

  // Prepare temperature
  let temperature;
  switch (creativity) {
    case LLM_CREATIVITY_HIGH:
      temperature = 1;
      break;
    case LLM_CREATIVITY_MEDIUM:
      temperature = 0.5;
      break;
    case LLM_CREATIVITY_LOW:
      temperature = 0.25;
      break;
    case LLM_CREATIVITY_NONE:
    default:
      temperature = 0;
      break;
  }

  // Prepare models
  let model;
  switch (quality) {
    case LLM_QUALITY_HIGH:
      model = COHERE_INFERENCE_MODEL_HIGH;
      break;
    case LLM_QUALITY_MEDIUM:
    default:
      model = COHERE_INFERENCE_MODEL_MED;
      break;
  }

  const coherePayload = {
    model,
    messages,
    temperature,
  };

  if (json) {
    coherePayload.responseFormat = { type: 'json_object' };
  }

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const chatResponse = await cohere.chat(coherePayload, COHERE_CLIENT_REQUEST_OPTIONS);

      return {
        model,
        output: json
          ? JSON.parse(chatResponse.message.content[0].text)
          : chatResponse.message.content[0].text,
        costUSD:
          chatResponse.usage.billedUnits.inputTokens * config.get(`llm:pricing:${model}:input`)
          + chatResponse.usage.billedUnits.outputTokens * config.get(`llm:pricing:${model}:output`),
      };
    } catch (err) {
      attempt += 1;
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 1000;
        await new Promise((resolve) => { setTimeout(resolve, delay); });
      } else {
        logger.error('inference', err);
        throw err;
      }
    }
  }

  throw new Error('Could not inference');
}

module.exports = {
  inference,
  getEmbeddingsModel,
  createEmbeddings,
  rerank,
};
