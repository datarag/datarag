/* eslint-disable consistent-return */
const _ = require('lodash');
const md5 = require('../helpers/md5');
const db = require('../db/models');
const registry = require('../registry');
const { flattenText, cleanText } = require('../helpers/chunker');
const cohere = require('../llms/cohere');
const openai = require('../llms/openai');
const { fullTextSearch } = require('../agents/fullTextSearch');
const { semanticSearch } = require('../agents/semanticSearch');
const config = require('../config');
const logger = require('../logger');
const { serializeDocument } = require('../helpers/serialize');
const { TreeNode } = require('../helpers/treenode');
const { createEmbeddings } = require('../agents/createEmbeddings');
const hydePrompt = require('../prompts/hydePrompt');
const { LLM_CREATIVITY_HIGH, LLM_QUALITY_MEDIUM } = require('../constants');

const RERANK_CUTOFF = config.get('retrieval:rerank:cutoff');
const { Op } = db.Sequelize;

/**
 * Given an API request payload, find the relevant datasource ids
 *
 * @param {*} { organization, agentId, datasourceIds, conversationId }
 * @return {*}
 */
async function findDatasourceIds({
  organization,
  agentResId,
  datasourceResIds,
  conversationResId,
}) {
  const data = [];

  if (agentResId) {
    const agent = await db.Agent.findOne({
      where: {
        OrganizationId: organization.id,
        resId: agentResId,
      },
    });
    if (agent) {
      const datasources = await agent.getDatasources({
        attributes: ['id'],
      });
      _.each(datasources, (model) => data.push(model.id));
    }
  }

  if (conversationResId) {
    const conversation = await db.Conversation.findOne({
      where: {
        OrganizationId: organization.id,
        resId: conversationResId,
      },
    });

    if (conversation) {
      const datasources = await organization.getDatasources({
        where: {
          ConversationId: conversation.id,
        },
        attributes: ['id'],
      });
      _.each(datasources, (model) => data.push(model.id));
    }
  }

  if (!_.isEmpty(datasourceResIds)) {
    const datasources = await organization.getDatasources({
      where: {
        resId: {
          [Op.in]: datasourceResIds,
        },
      },
      attributes: ['id'],
    });
    _.each(datasources, (model) => data.push(model.id));
  }

  // Clean duplicates
  return _.uniq(data);
}

/**
 * Given a user query, return a vector version
 *
 * @param {String} queryText
 * @param {String} queryType [query | document]
 * @return {*}
 */
async function prepareQuery(queryText, queryType = 'query') {
  const query = flattenText(cleanText(queryText));
  const key = `embedding:${queryType}:${md5(query)}`;

  // Check for cached response
  const existingVector = await registry.get(key);
  if (existingVector) {
    return {
      query,
      queryVector: existingVector,
      costUSD: 0,
    };
  }

  const queryAI = await createEmbeddings({
    texts: [query],
    type: queryType,
  });
  const queryVector = queryAI.embeddings[0];

  // Add to cache for 10'
  await registry.set(key, queryVector, 10 * 60);

  return {
    query,
    queryVector,
    costUSD: queryAI.costUSD,
  };
}

/**
 * Retrieve chunks
 *
 * @param {*} {
 *   organization, datasourceIds, prompt,
 *   maxTokens, maxChars, maxChunks,
 * }
 * @return {*}
 */
async function retrieveChunks({
  organization, datasourceIds, prompt,
  maxTokens, maxChars, maxChunks, ragLog,
}) {
  let costUSD = 0;
  let chunks = [];
  const chunksMap = {};
  let query;
  let queryVector;
  let hydeQuery;
  let hydeVector;

  const retrieveRagLog = ragLog.addChild(new TreeNode({
    type: 'retrieval',
    query: prompt,
    total_chunks: await db.Chunk.count({
      where: {
        OrganizationId: organization.id,
        DatasourceId: {
          [Op.in]: datasourceIds,
        },
      },
    }),
  }));
  retrieveRagLog.startMeasure();

  const addUniqueChunks = (newChunks) => {
    const addedChunks = [];
    _.each(newChunks, (chunk) => {
      if (chunksMap[chunk.id]) return;
      chunksMap[chunk.id] = true;
      chunks.push(chunk);
      addedChunks.push(chunk);
    });
    return addedChunks;
  };

  // create a vector on the query
  await Promise.all([
    (async () => {
      logger.debug('retrieveChunks', `Embedding query: ${prompt}`);
      const response = await prepareQuery(prompt);
      query = response.query;
      queryVector = response.queryVector;
      costUSD += response.costUSD;
    })(),

    (async () => {
      const response = await openai.inference({
        text: hydePrompt({ query: prompt }),
        creativity: LLM_CREATIVITY_HIGH,
        quality: LLM_QUALITY_MEDIUM,
      });
      costUSD += response.costUSD;

      logger.debug('retrieveChunks', `Embedding HyDE: ${response.output}`);
      const responseQuery = await prepareQuery(response.output, 'document');
      hydeQuery = responseQuery.query;
      hydeVector = responseQuery.queryVector;
      costUSD += responseQuery.costUSD;
    })(),
  ]);

  await Promise.all([
    // Full text search
    (async () => {
      logger.debug('retrieveChunks', `Full text search: ${query}`);

      // Add to Rag Log
      const searchRagLog = retrieveRagLog.addChild(new TreeNode({
        type: 'full_text_search',
        query,
      }));
      searchRagLog.startMeasure();

      const response = await fullTextSearch({
        query,
        queryVector,
        organizationId: organization.id,
        datasourceIds,
      });
      costUSD += response.costUSD;

      searchRagLog.endMeasure();

      logger.debug('retrieveChunks', `Full text search yield ${response.data.length} results`);

      const addedChunks = addUniqueChunks(response.data);

      // Register Rag Log response
      _.each(addedChunks, (chunk) => {
        searchRagLog.addChild(new TreeNode({
          type: 'chunk',
          similarity: chunk.similarity,
          chunk_ref: chunk.id,
          datasource_ref: chunk.DatasourceId,
          document_ref: chunk.DocumentId,
        }));
      });
    })(),
    // Semantic search
    (async () => {
      logger.debug('retrieveChunks', `Semantic search: ${query}`);

      // Add to Rag Log
      const searchRagLog = retrieveRagLog.addChild(new TreeNode({
        type: 'semantic_search',
        query,
      }));
      searchRagLog.startMeasure();

      const semanticChunks = [];

      await Promise.all([
        (async () => {
          const response = await semanticSearch({
            query,
            queryVector,
            organizationId: organization.id,
            datasourceIds,
          });
          costUSD += response.costUSD;
          semanticChunks.push(...response.data);
        })(),
        (async () => {
          const response = await semanticSearch({
            query: hydeQuery,
            queryVector: hydeVector,
            organizationId: organization.id,
            datasourceIds,
          });
          costUSD += response.costUSD;
          semanticChunks.push(...response.data);
        })(),
      ]);

      searchRagLog.endMeasure();

      logger.debug('retrieveChunks', `Semantic search yield ${semanticChunks.length} results`);

      // Add regular chunks
      const addedChunks = addUniqueChunks(semanticChunks);

      // Register Rag Log response
      _.each(addedChunks, (chunk) => {
        searchRagLog.addChild(new TreeNode({
          type: 'chunk',
          similarity: chunk.similarity,
          chunk_ref: chunk.id,
          datasource_ref: chunk.DatasourceId,
          document_ref: chunk.DocumentId,
        }));
      });

      // Process relations
      const relations = await db.Relation.findAll({
        where: {
          OrganizationId: organization.id,
          DatasourceId: {
            [Op.in]: datasourceIds,
          },
          ChunkId: {
            [Op.in]: _.map(semanticChunks, (chunk) => chunk.id),
          },
        },
      });

      const relChunks = await db.Chunk.findAll({
        where: {
          OrganizationId: organization.id,
          DatasourceId: {
            [Op.in]: datasourceIds,
          },
          id: {
            [Op.in]: _.map(relations, (relation) => relation.TargetChunkId),
          },
        },
      });

      const relAddedChunks = addUniqueChunks(relChunks);

      // Register Rag log
      const relAddedChunksHashIds = {};
      _.each(relAddedChunks, (chunk) => {
        relAddedChunksHashIds[chunk.id] = true;
      });

      const relationHashMap = {};
      _.each(relations, (relation) => {
        if (!relAddedChunksHashIds[relation.TargetChunkId]) return;
        relationHashMap[relation.ChunkId] = relation.TargetChunkId;
      });
      _.each(semanticChunks, (relChunk) => {
        if (!relationHashMap[relChunk.id]) return;
        searchRagLog.addChild(new TreeNode({
          type: relChunk.type,
          similarity: relChunk.similarity,
          chunk_ref: relChunk.id,
          datasource_ref: relChunk.DatasourceId,
          document_ref: relChunk.DocumentId,
        })).addChild(new TreeNode({
          type: relChunk.type,
          chunk_ref: relationHashMap[relChunk.id],
          datasource_ref: relChunk.DatasourceId,
          document_ref: relChunk.DocumentId,
        }));
      });
    })(),
  ]);

  if (chunks.length > 1000) {
    chunks = chunks.slice(0, 1000);
  }

  // Rerank
  logger.debug('retrieveChunks', `Reranking ${chunks.length} chunks`);

  const rerankRagLog = retrieveRagLog.addChild(new TreeNode({
    type: 'rerank',
    query,
    cutoff: RERANK_CUTOFF,
    input_chunk_count: chunks.length,
  }));
  rerankRagLog.startMeasure();

  const rerankResponse = await cohere.rerank({
    query: `${prompt}`,
    chunks,
    cutoff: RERANK_CUTOFF,
  });
  costUSD += rerankResponse.costUSD;
  chunks = rerankResponse.chunks;

  rerankRagLog.endMeasure();

  logger.debug('retrieveChunks', `Chunks reranked to ${chunks.length} chunks`);

  // Reduce chunks based on limits
  let countTokens = 0;
  let countChars = 0;
  let countChunks = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    countTokens += chunk.contentTokens;
    countChars += chunk.contentSize;
    countChunks += 1;
    if ((maxTokens > 0 && countTokens > maxTokens)
      || (maxChars > 0 && countChars > maxChars)
      || (maxChunks > 0 && countChunks > maxChunks)
    ) {
      chunks = chunks.slice(0, i);
    }
  }

  _.each(chunks, (chunk) => {
    rerankRagLog.addChild(new TreeNode({
      type: 'chunk',
      chunk_ref: chunk.id,
      datasource_ref: chunk.DatasourceId,
      document_ref: chunk.DocumentId,
      similarity: chunk.similarity,
      relevance_score: chunk.score,
    }));
  });

  // Final processing for relations
  const datasourceMap = {};
  const documentMap = {};

  await Promise.all([
    (async () => {
      // Find documents
      const documentIds = _.uniq(_.map(chunks, (chunk) => chunk.DocumentId));
      const documents = await organization.getDocuments({
        where: {
          DatasourceId: {
            [Op.in]: datasourceIds,
          },
          id: {
            [Op.in]: documentIds,
          },
        },
        attributes: ['id', 'resId', 'metadata'],
      });
      _.each(documents, (document) => {
        documentMap[document.id] = {
          resId: document.resId,
          metadata: document.metadata,
        };
      });
    })(),
    (async () => {
      // Find datasources
      const datasources = await organization.getDatasources({
        where: {
          id: {
            [Op.in]: datasourceIds,
          },
        },
        attributes: ['id', 'resId'],
      });
      _.each(datasources, (datasource) => {
        datasourceMap[datasource.id] = {
          resId: datasource.resId,
        };
      });
    })(),
  ]);

  // Prepare response
  const response = [];
  _.each(chunks, (chunk) => {
    const datasource = datasourceMap[chunk.DatasourceId];
    const document = documentMap[chunk.DocumentId];
    if (!datasource || !document) return;
    response.push({
      datasource_id: datasource.resId,
      document_id: document.resId,
      text: chunk.content,
      metadata: document.metadata,
      size: chunk.contentSize,
      tokens: chunk.contentTokens,
      score: chunk.score,
    });
  });

  retrieveRagLog.endMeasure();

  return {
    chunks: response,
    costUSD,
  };
}

/**
 * Retrieve question chunks
 *
 * @param {*} {
 *   organization, datasourceIds, prompt,
 *   maxChunks
 * }
 * @return {*}
 */
async function retrieveQuestions({
  organization, datasourceIds, prompt,
  maxChunks, ragLog,
}) {
  let costUSD = 0;
  let chunks = [];

  const retrieveRagLog = ragLog.addChild(new TreeNode({
    type: 'retrieval',
    query: prompt,
    total_chunks: await db.Chunk.count({
      where: {
        OrganizationId: organization.id,
        DatasourceId: {
          [Op.in]: datasourceIds,
        },
        type: 'question',
      },
    }),
  }));
  retrieveRagLog.startMeasure();

  // create a vector on the query
  logger.debug('retrieveQuestions', `Embedding query: ${prompt}`);
  const { query, queryVector, costUSD: qCostUSD } = await prepareQuery(prompt, 'document');
  costUSD += qCostUSD;

  logger.debug('retrieveQuestions', `Semantic search: ${query}`);

  // Add to Rag Log
  const searchRagLog = retrieveRagLog.addChild(new TreeNode({
    type: 'semantic_search',
    query,
  }));
  searchRagLog.startMeasure();

  const searchResponse = await semanticSearch({
    query,
    queryVector,
    organizationId: organization.id,
    datasourceIds,
    type: 'question',
    limit: maxChunks,
  });
  costUSD += searchResponse.costUSD;

  searchRagLog.endMeasure();

  logger.debug('retrieveQuestions', `Semantic search yield ${searchResponse.data.length} results`);

  // Filter duplicate chunks
  chunks = _.uniqBy(searchResponse.data, 'content');

  // Remove questions that match the prompt
  const locasePrompt = _.trim(_.toLower(prompt));
  chunks = _.filter(chunks, (chunk) => _.trim(_.toLower(chunk.content)) !== locasePrompt);

  // Register Rag Log response
  _.each(chunks, (chunk) => {
    searchRagLog.addChild(new TreeNode({
      type: 'chunk',
      similarity: chunk.similarity,
      chunk_ref: chunk.id,
      datasource_ref: chunk.DatasourceId,
      document_ref: chunk.DocumentId,
    }));
  });

  // Final processing for relations
  const datasourceMap = {};
  const documentMap = {};

  await Promise.all([
    (async () => {
      // Find documents
      const documentIds = _.uniq(_.map(chunks, (chunk) => chunk.DocumentId));
      const documents = await organization.getDocuments({
        where: {
          DatasourceId: {
            [Op.in]: datasourceIds,
          },
          id: {
            [Op.in]: documentIds,
          },
        },
        attributes: ['id', 'resId', 'metadata'],
      });
      _.each(documents, (document) => {
        documentMap[document.id] = {
          resId: document.resId,
          metadata: document.metadata,
        };
      });
    })(),
    (async () => {
      // Find datasources
      const datasources = await organization.getDatasources({
        where: {
          id: {
            [Op.in]: datasourceIds,
          },
        },
        attributes: ['id', 'resId'],
      });
      _.each(datasources, (datasource) => {
        datasourceMap[datasource.id] = {
          resId: datasource.resId,
        };
      });
    })(),
  ]);

  // Prepare response
  const response = [];
  _.each(chunks, (chunk) => {
    const datasource = datasourceMap[chunk.DatasourceId];
    const document = documentMap[chunk.DocumentId];
    if (!datasource || !document) return;
    response.push({
      datasource_id: datasource.resId,
      document_id: document.resId,
      text: chunk.content,
      metadata: document.metadata,
      size: chunk.contentSize,
      tokens: chunk.contentTokens,
      score: chunk.similarity,
    });
  });

  retrieveRagLog.endMeasure();

  return {
    chunks: response,
    costUSD,
  };
}

/**
 * Retrieve documents
 *
 * @param {*} {
 *   organization, datasourceIds, prompt,
 *   maxDocuments,
 * }
 * @return {*}
 */
async function retrieveDocuments({
  organization, datasourceIds, prompt,
  maxDocuments, ragLog,
}) {
  const retrieveRagLog = ragLog.addChild(new TreeNode({
    type: 'retrieval',
    query: prompt,
    total_chunks: await db.Chunk.count({
      where: {
        OrganizationId: organization.id,
        DatasourceId: {
          [Op.in]: datasourceIds,
        },
      },
    }),
  }));
  retrieveRagLog.startMeasure();

  let costUSD = 0;

  const { query, queryVector, costUSD: qCostUSD } = await prepareQuery(prompt);
  costUSD += qCostUSD;

  let documentIds = [];

  // Full text search (first pass)
  await (async () => {
    // Add to Rag log
    const searchRagLog = retrieveRagLog.addChild(new TreeNode({
      type: 'full_text_search',
      query,
    }));
    searchRagLog.startMeasure();

    const response = await fullTextSearch({
      query,
      queryVector,
      organizationId: organization.id,
      datasourceIds,
      limit: Math.max(100, maxDocuments || 0),
    });
    costUSD += response.costUSD;

    searchRagLog.endMeasure();

    _.each(response.data, (chunk) => {
      // Register Rag log response
      searchRagLog.addChild(new TreeNode({
        type: 'chunk',
        similarity: chunk.similarity,
        chunk_ref: chunk.id,
        datasource_ref: chunk.DatasourceId,
        document_ref: chunk.DocumentId,
      }));

      if (documentIds.indexOf(chunk.DocumentId) < 0) {
        documentIds.push(chunk.DocumentId);
      }
    });
  })();

  // Semantic search (second pass)
  if (maxDocuments > 0 && documentIds.length < maxDocuments) {
    await (async () => {
      // Add to Rag log
      const searchRagLog = retrieveRagLog.addChild(new TreeNode({
        type: 'semantic_search',
        query,
      }));
      searchRagLog.startMeasure();

      const response = await semanticSearch({
        query,
        queryVector,
        organizationId: organization.id,
        datasourceIds,
        limit: maxDocuments,
      });
      costUSD += response.costUSD;

      searchRagLog.endMeasure();

      _.each(response.data, (chunk) => {
        searchRagLog.addChild(new TreeNode({
          type: 'chunk',
          similarity: chunk.similarity,
          chunk_ref: chunk.id,
          datasource_ref: chunk.DatasourceId,
          document_ref: chunk.DocumentId,
        }));

        if (documentIds.indexOf(chunk.DocumentId) < 0) {
          documentIds.push(chunk.DocumentId);
        }
      });
    })();
  }

  if (maxDocuments > 0) {
    documentIds = documentIds.slice(0, maxDocuments);
  }

  const documents = await organization.getDocuments({
    where: {
      DatasourceId: {
        [Op.in]: datasourceIds,
      },
      id: {
        [Op.in]: documentIds,
      },
    },
  });

  retrieveRagLog.endMeasure();

  return {
    documentIds,
    documents: _.map(documents, (document) => serializeDocument(document)),
    costUSD,
  };
}

/**
 * Generate full text search snippets from a document id datasource
 *
 * @param {*} { organization, documentIds, prompt }
 * @return {[]}
 */
async function createSnippets({ organization, documentIds, prompt }) {
  if (_.isEmpty(documentIds)) {
    return [];
  }

  // Do full text search
  const chunks = await db.sequelize.query(`
    SELECT
      DISTINCT("DocumentId"),
      ts_rank("_search", websearch_to_tsquery('english', :query)) as rank,
      ts_headline('english', content, websearch_to_tsquery(:query), 'MaxWords=80, MinWords=40') as snippet
    FROM "${db.Chunk.tableName}"
    WHERE
      "OrganizationId" = :orgid AND
      "DocumentId" IN (:docids) AND
      "type" = 'chunk' AND
      "_search" @@ websearch_to_tsquery('english', :query)
    ORDER BY rank DESC
    LIMIT ${documentIds.length};
  `, {
    model: db.Chunk,
    replacements: {
      query: prompt,
      orgid: organization.id,
      docids: documentIds,
    },
  });

  const hashMap = {};
  _.each(chunks, (chunk) => {
    if (!hashMap[chunk.DocumentId] && chunk.get('snippet')) {
      hashMap[chunk.DocumentId] = chunk.get('snippet');
    }
  });

  return _.map(documentIds, (id) => {
    // Remove markdown
    let text = hashMap[id] || '';
    text = text.replace(/<b>/g, '%START%').replace(/<\/b>/g, '%END%');
    text = flattenText(text);
    text = text.replace(/%START%/g, '<b>').replace(/%END%/g, '</b>');
    return text.replace(/#/g, '');
  });
}

module.exports = {
  findDatasourceIds,
  prepareQuery,
  retrieveChunks,
  retrieveDocuments,
  retrieveQuestions,
  createSnippets,
};
