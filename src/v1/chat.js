const dayjs = require('dayjs');
const axios = require('axios');
const _ = require('lodash');
const { nanoid, customAlphabet } = require('nanoid');
const db = require('../db/models');
const { apiRoute, badRequestResponse } = require('../helpers/responses');
const { getCannedResponse } = require('../helpers/cannedResponse');
const logger = require('../logger');
const config = require('../config');
const { findDatasourceIds, retrieveChunks } = require('./retrieveCommon');
const { convertToFunctionName, nameFunction } = require('../helpers/utils');
const {
  chatStream,
  inference,
  textToTokens,
  tokensToText,
} = require('../llms/openai');
const { TreeNode } = require('../helpers/treenode');
const { SCOPE_CHAT } = require('../scopes');
const {
  LLM_CREATIVITY_NONE,
  LLM_QUALITY_MEDIUM,
  LLM_QUALITY_HIGH,
  LLM_CREATIVITY_HIGH,
  RESID_PREFIX_TURN,
  RESID_PREFIX_CONVERSATION_DOCUMENT,
} = require('../constants');
const classifyQueryPrompt = require('../prompts/classifyQueryPrompt');
const chatPrompt = require('../prompts/chatPrompt');
const conversationTitlePrompt = require('../prompts/conversationTitlePrompt');
const chatInstructions = require('../prompts/chatInstructions');

const { Op } = db.Sequelize;
const HISTORY_MAXTOKENS = config.get('chat:history:maxtokens');
const INSTRUCTIONS_MAXTOKENS = config.get('chat:instructions:maxtokens');
const TURN_CONTEXT_MAXTOKENS = config.get('chat:turn:context:maxtokens');
const MAX_CONVERSATIONS = config.get('chat:max:conversations');
const MAX_TURNS = config.get('chat:max:turns');

/**
 * Extract the "response" property from a partial build JSON
 *
 * @param {*} jsonString
 * @return {String}
 */
function extractResponse(jsonString) {
  if (!jsonString) return null;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.response) {
      return parsed.response;
    }
  } catch (err) {
    try {
      const match = jsonString.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (err2) {
      // pass
    }
  }
  return null;
}

/**
 * Limit text up to X tokens
 *
 * @param {String} text
 * @param {Number} maxTokens
 * @return {*}
 */
function truncateToTokens(text, maxTokens) {
  if (!text || maxTokens <= 0) {
    return {
      text: '',
      tokens: 0,
    };
  }

  const tokens = textToTokens(text);

  if (tokens.length > maxTokens) {
    const truncatedTokens = tokens.slice(0, maxTokens);
    return {
      text: tokensToText(truncatedTokens),
      tokens: maxTokens,
    };
  }

  return {
    text,
    tokens: tokens.length,
  };
}

/**
 * Generate LLM instructions
 *
 * @param {*} organization
 * @param {*} payload
 * @return {*}
 */
async function getInstructions(organization, payload) {
  let instructions = payload.instructions || '';

  if (!instructions && payload.agent_id) {
    const agent = await db.Agent.findOne({
      where: {
        OrganizationId: organization.id,
        resId: payload.agent_id,
      },
    });
    if (agent && agent.purpose) {
      instructions = agent.purpose;
    }
  }
  instructions += `\nToday is ${dayjs().format('dddd, MMMM DD, YYYY HH:mm:ss')}.`;

  return truncateToTokens(instructions, INSTRUCTIONS_MAXTOKENS).text;
}

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Chat:
  *       type: object
  *       properties:
  *         message:
  *           type: string
  *           example: |
  *             Machine learning is a subset of artificial intelligence that involves
  *             the use of algorithms and statistical models.
  *           description: The LLM message response.
  *         conversation_id:
  *           type: string
  *           example: c5cb1ff3
  *           description: Conversation id associated with this chat turn or null.
  *         chunk:
  *           type: string
  *           example: |
  *             learning is
  *           description: Chunk of text [STREAM ONLY].
  *         finished:
  *           type: boolean
  *           example: true
  *           description: If chat was finished, useful when streaming is enabled.
  *         classification:
  *           type: string
  *           enum: [question, task, unknown]
  *           example: question
  *           description: Classification of the user query.
  *         confidence:
  *           type: integer
  *           example: 4
  *           description: |
  *             Confidence level of the quality of the answer from 0 (low) to 5 (high).
  *         sources:
  *           type: array
  *           description: A list of datasources/documents used to compose the answer.
  *           items:
  *             type: object
  *             properties:
  *               datasource_id:
  *                 type: string
  *                 example: 'help-center'
  *                 description: |
  *                   The datasource id or null if source is originating from conversation training.
  *               document_id:
  *                 type: string
  *                 example: 'help-center-article'
  *                 description: |
  *                   The document id or null if source is originating from conversation training.
  *               metadata:
  *                 type: object
  *                 description: Document metadata or empty object
  *
  *     NewChatQuery:
  *       type: object
  *       required:
  *         - query
  *       properties:
  *         agent_id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'website-agent'
  *           description: The id of the agent to be used in RAG.
  *         datasource_ids:
  *           type: array
  *           items:
  *             type: string
  *             pattern: '^[a-zA-Z0-9_-]+$'
  *             maxLength: 255
  *             example: 'website-agent'
  *           description: An array of datasource ids to be used in RAG.
  *         conversation_id:
  *           type: string
  *           example: c5cb1ff3
  *           description: |
  *             Optionally associate this chat turn with
  *             a Conversation to continue chat with memory.
  *         turn_context:
  *           type: array
  *           description: Additional custom knowledge context to be used in this turn.
  *           items:
  *             type: object
  *             properties:
  *               text:
  *                 type: string
  *                 example: Dogs and cats are animals
  *                 description: Text context
  *               metadata:
  *                 type: object
  *         turn_metadata:
  *           type: object
  *           description: Turn metadata object to be stored in conversation turn history.
  *         instructions:
  *           type: string
  *           example: 'You are a helpful assistant'
  *           description: LLM instructions.
  *         query:
  *           type: string
  *           example: 'What is machine learning?'
  *           description: User message.
  *         grounded_response:
  *           type: boolean
  *           example: false
  *           default: true
  *           description: |
  *             Whether the response should be fully grounded in facts from knowledge base or not.
  *         stream:
  *           type: boolean
  *           example: true
  *           default: false
  *           description: Whether to stream response.
  *         max_tokens:
  *           type: integer
  *           example: 250
  *           description: |
  *             Retrieve chunks up to max tokens [defaults to 8192 if no max limits defined].
  *         max_chars:
  *           type: integer
  *           example: 500
  *           description: Retrieve chunks up to max characters.
  *         max_chunks:
  *           type: integer
  *           example: 10
  *           description: Limit of chunks to retrieve (top_k).
  */

  /**
  * @swagger
  * /v1/chat:
  *   post:
  *     tags:
  *       - Generative AI
  *     summary: Chat
  *     parameters:
  *       - in: header
  *         name: X-Connector-Auth
  *         description: |
  *           Optional authentication header that will be propagated to any request made
  *           to datasource connectors. For example, this header can be a JWT that will
  *           restrict connector results to only specific resource, e.g. when used in a
  *           multi-tenant setup.
  *         schema:
  *           type: string
  *     description: |
  *       Run prompt over an LLM for Retrieval Augmented Generation,
  *       over a set of datasources for grounded knowledge.
  *       You may augment an agent, a set of datasources, custom context or combination of those.
  *
  *       **API Scope: `chat`**
  *     requestBody:
  *       description: Generation properties.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/NewChatQuery'
  *     responses:
  *       '200':
  *         description: LLM response
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Chat'
  *                 meta:
  *                   type: object
  *                   properties:
  *                     processing_time_ms:
  *                        type: integer
  *                        description: Time required to process the request in milliseconds.
  *                        example: 752
  *                     query:
  *                        type: string
  *                        description: The initial requested query.
  *                        example: 'What is machine learning?'
  *                     model:
  *                        type: string
  *                        description: The LLM model used for inference.
  *                        example: 'gpt-4o'
  *                     answered:
  *                        type: boolean
  *                        example: true
  *                        description: Whether the user query was answered or not.
  *                     transaction_id:
  *                        type: string
  *                        description: A transaction identifier.
  *                        example: fhxJfds-1jv
  *       '400':
  *         description: Bad request
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/BadRequest'
  *       '401':
  *         description: Unauthorized access
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UnauthorizedError'
  */
  router.post(
    '/chat',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const now = Date.now();
      const uuid = nanoid();
      const cannedResponse = getCannedResponse();
      const payload = req.body.data;

      let queryCostUSD = 0;
      const knowledgeIdToSource = {};
      const knowledgeDocumentIdHash = {};
      const knowledgeToPrompt = [];

      let datasourceIds = [];
      let convDatasourceIds = [];
      let conversation = null;
      let turns = [];
      let classification = 'other';
      let sources = [];
      let confidence = 0;
      let finalText = '';
      let model = '';
      let answered = false;

      // Log chat message
      const log = (message) => {
        logger.info(`Chat / ${req.organization.resId} / ${uuid}`, message);
      };

      // Given a knowledge base array of object, register them for source reference
      // in the final response, and format them to be consumed as LLM function response
      // Structure:
      // [{
      //   id, text, chunk, datasource_id, document_id, metadata
      // }]
      const formatKnowledgeBase = (data) => {
        const response = [];

        _.each(data, (entry) => {
          // Hash reference
          knowledgeToPrompt.push(_.pick(entry, ['id', 'text', 'chunk']));
          knowledgeIdToSource[entry.id] = _.pick(entry, ['datasource_id', 'document_id', 'metadata']);
          knowledgeDocumentIdHash[`${entry.datasource_id}/${entry.document_id}`] = true;

          // Format response
          let content = `Document id: ${entry.id}\n\n`;
          _.each(entry.metadata, (value, key) => {
            content += `${key}: ${_.isString(value) ? value : JSON.stringify(value)}\n\n`;
          });
          content += `${entry.text}`;

          response.push({
            document_id: entry.id,
            content,
          });
        });

        return response;
      };

      // Defaults
      if (!payload.max_tokens && !payload.max_chars && !payload.max_chunks) {
        payload.max_tokens = 8192;
      }

      log('Chat started');

      // Initiate RAG log object
      const ragLog = new TreeNode({
        type: 'chat',
        timestamp: now,
      });
      ragLog.startMeasure();
      req.ragLog = ragLog;

      // --------------- Conversation history ---------------

      if (payload.conversation_id) {
        conversation = await db.Conversation.findOne({
          where: {
            OrganizationId: req.organization.id,
            ApiKeyId: req.apiKey.id,
            resId: payload.conversation_id,
          },
        });

        if (!conversation) {
          badRequestResponse(req, res, 'Invalid conversation_id');
          return;
        }
      }

      await Promise.all([
        // Turns
        (async () => {
          if (conversation) {
            turns = await conversation.getTurns({
              order: [['createdAt', 'ASC']],
            });
          }
        })(),

        // Datasources
        (async () => {
          datasourceIds = await findDatasourceIds({
            organization: req.organization,
            agentResId: payload.agent_id,
            datasourceResIds: payload.datasource_ids,
            conversationResId: payload.conversation_id,
          });
        })(),

        // Conversation datasources
        (async () => {
          if (payload.conversation_id) {
            convDatasourceIds = await findDatasourceIds({
              organization: req.organization,
              conversationResId: payload.conversation_id,
            });
          }
        })(),

        // Classification
        (async () => {
          const inferenceResponse = await inference({
            text: classifyQueryPrompt({ query: payload.query }),
            creativity: LLM_CREATIVITY_NONE,
            quality: LLM_QUALITY_MEDIUM,
            json: true,
          });
          queryCostUSD += inferenceResponse.costUSD;
          classification = inferenceResponse.output.classification || 'other';
        })(),
      ]);

      // --------------- Stream management ---------------

      if (payload.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      let fullStream = '';
      let extractedStream = '';
      async function streamFn(text) {
        if (!payload.stream || !text) return;

        fullStream += text;
        const newExtractedStream = extractResponse(fullStream);
        if (!newExtractedStream) return;

        const chunk = newExtractedStream.substring(extractedStream.length);
        extractedStream = newExtractedStream;

        const partial = {
          data: {
            chunk: chunk
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\f/g, '\f')
              .replace(/\\b/g, '\b')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\'),
            finished: false,
          },
        };
        res.write(`data: ${JSON.stringify(partial)}\n\n`);
        res.flush();
      }

      // --------------- LLM Chat ---------------

      await (async () => {
        // Setup OpenAI tools
        const connectorAuthHeader = req.headers['x-connector-auth'];
        const toolNameHash = {};
        const tools = [];
        const searchDataSourceIds = [];
        await Promise.all(_.map(datasourceIds, async (datasourceId) => {
          // Check if datasource has chunks and register a generic search function
          const hasChunk = await db.Chunk.findOne({
            where: {
              OrganizationId: req.organization.id,
              DatasourceId: datasourceId,
            },
          });
          if (hasChunk) {
            searchDataSourceIds.push(datasourceId);
          }

          // Setup connectors
          const connectors = await req.organization.getConnectors({
            where: {
              DatasourceId: datasourceId,
            },
          });
          _.each(connectors, (connector) => {
            let fnName = convertToFunctionName(connector.name);
            if (toolNameHash[fnName]) {
              fnName = `${fnName}_${customAlphabet('1234567890abcdef', 5)()}`;
            }
            toolNameHash[fnName] = true;
            const fnCall = nameFunction(fnName, async (args) => {
              try {
                logger.debug('connector:call', connector.name);
                logger.debug('connector:args', JSON.stringify(args, null, 2));
                log(`Calling tool API ${connector.endpoint} [${connector.method}]`);

                // Add connector request to RAG log
                const reqRagLog = ragLog.addChild(new TreeNode({
                  type: 'connector',
                  name: connector.name,
                  method: connector.method,
                  endpoint: connector.endpoint,
                  request: { data: args },
                }));
                reqRagLog.startMeasure();

                // Make the actual request
                const response = await axios({
                  method: connector.method,
                  url: connector.endpoint,
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Connector-Auth': connectorAuthHeader || '',
                  },
                  data: JSON.stringify({ data: args }),
                });
                logger.debug('connector:response', response.data);

                // Add connector response to RAG log
                reqRagLog.appendData({
                  response: {
                    status: response.status,
                    data: response.data,
                  },
                });
                reqRagLog.endMeasure();

                if (response.data.data) {
                  log(`Received ${connector.endpoint} [${connector.method}] data`);
                  return response.data.data;
                }
                log(`No data received ${connector.endpoint} [${connector.method}]`);
              } catch (err) {
                logger.error('connector', err);
              }
              return '';
            });
            const properties = {};
            const required = [];

            _.each(connector.payload, (value, key) => {
              let type;
              switch (value.type) {
                case 'str':
                  type = 'string';
                  break;
                case 'number':
                  type = 'number';
                  break;
                case 'bool':
                  type = 'boolean';
                  break;
                default:
                  break;
              }
              if (!type) return;

              properties[key] = {
                type,
                description: value.description,
              };

              if (value.required) {
                required.push(key);
              }
            });

            tools.push({
              type: 'function',
              function: {
                function: fnCall,
                description: connector.purpose,
                parse: JSON.parse,
                parameters: {
                  type: 'object',
                  properties,
                  required,
                  additionalProperties: false,
                },
              },
            });
          });
        }));

        if (!_.isEmpty(searchDataSourceIds)) {
          const searchKnowledgeBase = async (args) => {
            logger.debug('datasource:call', 'searchKnowledgeBase');
            logger.debug('datasource:query', args.query);

            if (!args.query) return [];

            const { costUSD, chunks } = await retrieveChunks({
              organization: req.organization,
              datasourceIds: searchDataSourceIds,
              prompt: args.query,
              maxTokens: payload.max_tokens,
              maxChars: payload.max_chars,
              maxChunks: payload.max_chunks,
              ragLog,
            });
            queryCostUSD += costUSD;
            logger.debug('datasource:response', `${chunks.length} retrieved`);
            log(`Searching knowledge base yield ${chunks.length} chunks`);

            // Add to knowledge
            const knowledge = [];
            _.each(chunks, (chunk) => {
              knowledge.push({
                id: nanoid(),
                text: chunk.text,
                metadata: chunk.metadata || {},
                datasource_id: chunk.datasource_id,
                document_id: chunk.document_id,
              });
            });

            return formatKnowledgeBase(knowledge);
          };

          tools.push({
            type: 'function',
            function: {
              function: searchKnowledgeBase,
              description: 'Given a user query, search and retrieve related information from your knowledge base',
              parse: JSON.parse,
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The user query to be used for searching, reformulated under the context of the conversation history',
                  },
                },
                required: ['query'],
                additionalProperties: false,
              },
            },
          });
        }

        if (!_.isEmpty(payload.turn_context) || !_.isEmpty(convDatasourceIds)) {
          const getCurrentPage = async () => {
            logger.debug('datasource:call', 'getCurrentPage');
            logger.debug('datasource:query', payload.query);

            const knowledge = [];

            // Get local context
            if (!_.isEmpty(payload.turn_context)) {
              // Limit budgets
              let maxTokens = TURN_CONTEXT_MAXTOKENS;
              _.each(payload.turn_context, (context) => {
                if (!context.text) return;
                // Text
                const truncatedText = truncateToTokens(context.text, maxTokens);
                maxTokens -= truncatedText.tokens;
                const text = truncatedText.text;
                // Metadata
                let metadata = context.metadata || {};
                const metadataString = JSON.stringify(metadata);
                const truncatedMetadata = truncateToTokens(metadataString, maxTokens);
                if (truncatedMetadata.text === metadataString) {
                  maxTokens -= truncatedMetadata.tokens;
                } else {
                  metadata = {};
                }
                knowledge.push({
                  id: nanoid(),
                  text,
                  metadata,
                  datasource_id: '',
                  document_id: '',
                });
              });
            } else if (!_.isEmpty(convDatasourceIds)) {
              // Get conversation chunks
              const { costUSD, chunks } = await retrieveChunks({
                organization: req.organization,
                datasourceIds: convDatasourceIds,
                prompt: payload.query,
                maxTokens: payload.max_tokens,
                maxChars: payload.max_chars,
                maxChunks: payload.max_chunks,
                ragLog,
              });
              queryCostUSD += costUSD;
              logger.debug('datasource:memory:response', `${chunks.length} retrieved`);
              log(`Searching memory yield ${chunks.length} chunks`);

              // Add to knowledge
              _.each(chunks, (chunk) => {
                knowledge.push({
                  id: nanoid(),
                  text: chunk.text,
                  metadata: chunk.metadata || {},
                  datasource_id: chunk.datasource_id,
                  document_id: chunk.document_id,
                });
              });
            }

            return formatKnowledgeBase(knowledge);
          };

          tools.push({
            type: 'function',
            function: {
              function: getCurrentPage,
              description: 'Get the current content the user is viewing, such as an active web page or PDF, in a Chrome tab.',
              parse: JSON.parse,
            },
          });
        }

        // --------------- Messages ---------------

        // Add conversation history
        const conversationHistory = [];
        if (!_.isEmpty(turns)) {
          let turnTokens = 0;
          _.each(_.reverse(turns), (turn) => {
            if (turnTokens >= HISTORY_MAXTOKENS) return;
            turnTokens += turn.tokens;
            conversationHistory.unshift({
              user: turn.payload.meta.query,
              assistant: turn.payload.data.message,
            });
          });
        }

        // Generate instructions prompt
        const instructionsPrompt = chatInstructions({
          instructions: getInstructions(req.organization, payload),
          grounding: !!payload.grounded_response,
          cannedResponse: getCannedResponse(),
        });

        // Generate user prompt
        const userPrompt = chatPrompt({
          conversationHistory,
          query: payload.query,
        });

        const chatResponse = await chatStream({
          quality:
            classification === 'task'
              ? LLM_QUALITY_HIGH
              : LLM_QUALITY_MEDIUM,
          messages: [{
            role: 'user',
            content: `
${instructionsPrompt}

------------------------------------------------------

${userPrompt}
            `,
          }],
          tools,
          streamFn,
        });
        queryCostUSD += chatResponse.costUSD;

        finalText = extractResponse(chatResponse.text);
        model = chatResponse.model;

        try {
          const jsonResponse = JSON.parse(chatResponse.text);
          finalText = jsonResponse.response || finalText;
          answered = !!jsonResponse.answered;
          // Find sources used to answer question
          const usedKnowledgeDocumentIdHash = {};
          _.each(jsonResponse.documents, (documentId) => {
            if (knowledgeIdToSource[documentId]) {
              const dt = knowledgeIdToSource[documentId];
              sources.push(dt);
              usedKnowledgeDocumentIdHash[`${dt.datasource_id}/${dt.document_id}`] = true;
            }
          });
          // Generate confidence level
          if (_.keys(knowledgeDocumentIdHash).length > 0) {
            confidence = Math.ceil(
              (_.keys(usedKnowledgeDocumentIdHash).length * 5)
              / _.keys(knowledgeDocumentIdHash).length,
            );
          }
        } catch (err) {
          // no-op
        }
      })();

      if (!finalText) {
        streamFn(cannedResponse);
      }

      // Clean sources
      sources = _.map(sources, (source) => {
        if (!source.document_id
          || source.document_id.indexOf(RESID_PREFIX_CONVERSATION_DOCUMENT) === 0
        ) {
          source.document_id = null;
          source.datasource_id = null;
        }
        return source;
      });
      // Remove empty values
      sources = _.filter(sources, (source) => {
        return (source.document_id && source.datasource_id) || !_.isEmpty(source.metadata);
      });
      // Remove duplicates
      sources = _.uniqWith(sources, _.isEqual);

      const finalResponse = {
        data: {
          message: finalText || cannedResponse,
          conversation_id: conversation ? conversation.resId : null,
          finished: true,
          classification,
          confidence,
          sources,
        },
        meta: {
          model,
          answered,
          query: payload.query,
          processing_time_ms: Date.now() - now,
          transaction_id: req.transactionId,
        },
      };

      ragLog.appendData({
        response: finalResponse,
      });
      ragLog.endMeasure();

      req.transactionAction = 'chat';
      req.transactionCostUSD = queryCostUSD;

      if (!payload.stream) {
        res.json(finalResponse);
      } else {
        res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
        res.flush();
        res.end();
      }

      if (conversation) {
        // -------- Add to conversation turns --------

        await db.Turn.create({
          OrganizationId: conversation.OrganizationId,
          ApiKeyId: conversation.ApiKeyId,
          ConversationId: conversation.id,
          resId: `${RESID_PREFIX_TURN}${nanoid()}`,
          payload: finalResponse,
          metadata: payload.turn_metadata || {},
          tokens:
            textToTokens(finalResponse.data.message).length
            + textToTokens(finalResponse.meta.query).length,
        });

        await (async () => {
          const idsToDelete = await db.Turn.findAll({
            where: {
              ConversationId: conversation.id,
            },
            attributes: ['id'],
            order: [['updatedAt', 'DESC']],
            offset: MAX_TURNS,
            raw: true,
          }).then((records) => records.map((record) => record.id));

          if (idsToDelete.length > 0) {
            log(`Deleting ${idsToDelete.length} past turns`);
            await db.Turn.destroy({
              where: {
                id: {
                  [Op.in]: idsToDelete,
                },
              },
            });
          }
        })();

        // -------- Create title --------

        if (!conversation.title) {
          try {
            const titleResponse = await inference({
              text: conversationTitlePrompt({
                query: `
  ${payload.query}
  ${finalResponse.data.message}
                `,
              }),
              creativity: LLM_CREATIVITY_HIGH,
              quality: LLM_QUALITY_MEDIUM,
              json: true,
            });
            await conversation.update({
              title: titleResponse.output.title || 'Unnamed',
            });
          } catch (err) {
            // no-op
          }
        }

        // -------- Delete history --------

        await (async () => {
          const idsToDelete = await db.Conversation.findAll({
            where: {
              OrganizationId: req.organization.id,
              ApiKeyId: req.apiKey.id,
            },
            attributes: ['id'],
            order: [['updatedAt', 'DESC']],
            offset: MAX_CONVERSATIONS,
            raw: true,
          }).then((records) => records.map((record) => record.id));

          if (idsToDelete.length > 0) {
            log(`Deleting ${idsToDelete.length} past conversations`);
            await db.Conversation.destroy({
              where: {
                id: {
                  [Op.in]: idsToDelete,
                },
              },
            });
          }
        })();
      }
    }),
  );
};
