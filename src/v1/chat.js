const dayjs = require('dayjs');
const axios = require('axios');
const _ = require('lodash');
const { nanoid, customAlphabet } = require('nanoid');
const db = require('../db/models');
const { apiRoute, badRequestResponse } = require('../helpers/responses');
const { getCannedResponse } = require('../helpers/cannedResponse');
const logger = require('../logger');
const { findDatasourceIds, retrieveChunks } = require('./retrieveCommon');
const { convertToFunctionName, nameFunction } = require('../helpers/utils');
const { chatStream } = require('../llms/openai');
const { TreeNode } = require('../helpers/treenode');

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
  *           description: Conversation id to be able to continue conversations with memory.
  *         chunk:
  *           type: string
  *           example: |
  *             learning is
  *           description: Chunk of text [STREAM ONLY].
  *         finished:
  *           type: boolean
  *           example: true
  *           description: If chat was finished, useful when streaming is enabled.
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
  *         query:
  *           type: string
  *           example: 'What is machine learning?'
  *           description: User message.
  *         instructions:
  *           type: string
  *           example: 'You are a helpful assistant'
  *           description: LLM instructions.
  *         conversation_id:
  *           type: string
  *           example: c5cb1ff3
  *           description: Previous conversation id to continue conversations with memory.
  *         stream:
  *           type: boolean
  *           example: true
  *           default: false
  *           description: Whether to stream response.
  *         max_tokens:
  *           type: integer
  *           example: 250
  *           description: |
  *             Retrieve chunks up to max tokens [defaults to 4096 if no max limits defined].
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
  *       You may augment a agent, a set of datasources, or both.
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
    apiRoute(async (req, res) => {
      const provider = 'openai';
      const now = Date.now();
      const uuid = nanoid();

      const log = (message) => {
        logger.info(`Chat / ${req.organization.resId} / ${uuid}`, message);
      };

      let queryCostUSD = 0;
      const payload = req.body.data;

      if (!payload.max_tokens && !payload.max_chars && !payload.max_chunks) {
        payload.max_tokens = 4096;
      }

      log('Chat started');

      // Initiate RAG log object
      const ragLog = new TreeNode({
        type: 'chat',
        provider,
        timestamp: now,
        request: payload,
      });
      ragLog.startMeasure();
      req.ragLog = ragLog;

      // Find instructions

      let instructions = payload.instructions || '';
      if (!instructions && payload.agent_id) {
        const agent = await db.Agent.findOne({
          where: {
            OrganizationId: req.organization.id,
            resId: payload.agent_id,
          },
        });
        if (agent && agent.purpose) {
          instructions = agent.purpose;
        }
      }
      instructions += `\nToday is ${dayjs().format('dddd, MMMM DD, YYYY HH:mm:ss')}.\nDo not use any prior knowledge.`;

      // Add instructions to RAG log
      ragLog.appendData({
        instructions,
      });

      // Filter out datasources

      const datasourceIds = await findDatasourceIds({
        organization: req.organization,
        agentResId: payload.agent_id,
        datasourceResIds: payload.datasource_ids,
      });
      log(`Found ${datasourceIds.length} datasources`);

      if (_.isEmpty(datasourceIds)) {
        log('No datasources found');
        badRequestResponse(req, res, 'No datasources found. Specify agent_id, datasource_ids, or both');
        return;
      }

      // Locate previous convertation

      let conversation;

      if (payload.conversation_id) {
        conversation = await db.Conversation.findOne({
          where: {
            OrganizationId: req.organization.id,
            resId: payload.conversation_id,
          },
        });
        if (!conversation) {
          badRequestResponse(req, res, 'Invalid conversation_id');
          return;
        }
        // Check convertation versioning
        if (conversation.history.provider !== provider) {
          conversation = null;
        }
      }

      // Setup OpenAI tools

      const connectorAuthHeader = req.headers['x-connector-auth'];
      const toolNameHash = {
        searchKnowledgebase: true,
      };
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

              if (_.isArray(response.data.data)) {
                log(`Received ${connector.endpoint} [${connector.method}]: ${response.data.data.length} data`);
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

      async function searchKnowledgebase(args) {
        logger.debug('datasource:call', 'searchKnowledgebase');
        logger.debug('datasource:args', JSON.stringify(args, null, 2));
        if (!args.query) return '';
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
        return {
          knowledge: _.map(chunks, (chunk) => ({
            text: chunk.text,
            metadata: chunk.metadata || {},
          })),
        };
      }

      if (!_.isEmpty(searchDataSourceIds)) {
        const fields = {
          type: 'function',
          function: {
            function: searchKnowledgebase,
            description: 'Search knowledge base for information related to user input.',
            parse: JSON.parse,
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The user input text to be used in search',
                },
              },
              required: ['query'],
              additionalProperties: false,
            },
          },
        };
        tools.push(fields);
      }

      async function streamFn(text) {
        if (!payload.stream) return;
        const partial = {
          data: {
            chunk: text,
            finished: false,
          },
        };
        res.write(`data: ${JSON.stringify(partial)}\n\n`);
        res.flush();
      }

      const prevMessages = conversation ? conversation.history.messages : [];

      if (!_.isEmpty(prevMessages)) {
        ragLog.appendData({
          prev_messages_count: prevMessages.length,
        });
      }

      if (_.isEmpty(prevMessages) && instructions) {
        prevMessages.push({ role: 'system', content: instructions });
      }

      if (payload.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      const cannedResponse = getCannedResponse();
      let query = payload.query;
      if (!_.isEmpty(tools)) {
        query = `
# Task 1: Retrieval

Utilize the information available in your knowledge base and the retriever tools to generate a comprehensive and
concise response to the question below.

Ensure your answer is directly relevant to the question asked.

If initial attempts do not yield sufficient information, use semantically different queries with the retriever tools to gather more data.

Make multiple attempts if necessary to ensure the question is completely and accurately addressed.

If in doubt, always call the 'searchKnowledgebase' function with a best guess query.

If you cannot produce a relevant answer, ask for additional information to be able to use the retrievers, or respond using the phrase:
${cannedResponse}

---

# Task 2: Formatting

Ensure that the answer is in an output format as described in the instructions.
If no format is specified in the instructions, respond in Markdown format, ensuring the response does not contain any broken elements.

---

# Task 3: Proofreading

Ensure the answer is free of typos by carefully proofreading for any spelling or grammatical errors,
and correct them if needed, while maintaining the meaning, formatting, and style of the previous answer.

---

# Task 4: Translation

Detect the language of the input question and the produced answer. If the language is different,
try to translate the answer to match the user's language.

---

User input question:
${payload.query}`;
      }

      const { text, costUSD, chatHistory } = await chatStream({
        chatHistory: prevMessages,
        query,
        tools,
        streamFn,
      });

      // Fix chatHistory issues from OpenAI SDK
      _.each(chatHistory, (entry) => {
        if (entry.content && entry.tool_calls) {
          entry.tool_calls = null;
        }
      });

      queryCostUSD += costUSD;

      if (conversation) {
        await conversation.update({
          history: {
            provider,
            messages: chatHistory,
          },
        });
      } else {
        conversation = await db.Conversation.create({
          OrganizationId: req.organization.id,
          resId: nanoid(),
          history: {
            provider,
            messages: chatHistory,
          },
        });
      }

      if (!text) {
        streamFn(cannedResponse);
      }

      const finalResponse = {
        data: {
          message: text || cannedResponse,
          conversation_id: conversation.resId,
          finished: true,
        },
        meta: {
          prompt: payload.prompt,
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
    }),
  );
};
