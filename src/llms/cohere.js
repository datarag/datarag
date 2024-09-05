/* eslint-disable no-param-reassign */
const _ = require('lodash');
const { CohereClient } = require('cohere-ai');
const config = require('../config');
const logger = require('../logger');
const { findMedian } = require('../helpers/utils');

const COHERE_EMBEDDINGS_MODEL = 'embed-multilingual-v3.0';
const COHERE_RERANK_MODEL = 'rerank-multilingual-v3.0';

const COHERE_CLIENT_CONFIG = {
  token: config.get('secrets:cohere_api_key'),
};
const COHERE_CLIENT_REQUEST_OPTIONS = {
  timeoutInSeconds: 60,
};

const MAX_RETRIES = 10;

/**
 * Create embeddings over a set of texts for document or query use
 *
 * @param {*} { texts, type }
 * @return {*}
 */
async function createEmbeddings({ texts, type }) {
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

  if (process.env.NODE_ENV === 'test' || _.isEmpty(texts)) {
    return {
      embeddings: _.map(texts, () => _.range(0, 1024)),
      costUSD: 0,
    };
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
    costUSD: (tokens * 0.1) / 1000000,
    embeddings,
  };

  return response;
}

/**
 * Perform reranking on a set of chunks
 *
 * @param {*} { query, chunks, threshold }
 * @return {*}
 */
async function rerank({ query, chunks, threshold }) {
  const cohere = new CohereClient(COHERE_CLIENT_CONFIG);

  if (process.env.NODE_ENV === 'test' || _.isEmpty(chunks)) {
    return {
      chunks,
      costUSD: 0,
    };
  }

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

      const median = findMedian(_.map(rerankResponse.results, (result) => result.relevanceScore));

      const filteredChunks = [];
      const sortedChunks = [];
      _.each(rerankResponse.results, (result) => {
        const chunk = chunks[result.index];
        chunk.score = result.relevanceScore;
        sortedChunks.push(chunk);
        if (result.relevanceScore >= (threshold * median)) {
          filteredChunks.push(chunk);
        }
      });

      const response = {
        costUSD: 2 / 1000,
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

module.exports = {
  createEmbeddings,
  rerank,
};
