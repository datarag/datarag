const _ = require('lodash');
const { apiRoute, badRequestResponse } = require('../helpers/responses');
const { findDatasourceIds, retrieveChunks } = require('./retrieveCommon');
const { TreeNode } = require('../helpers/treenode');

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Chunk:
  *       type: object
  *       properties:
  *         datasource_id:
  *           type: string
  *           example: 'help-center'
  *           description: The id of the datasource.
  *         document_id:
  *           type: string
  *           example: 'help-center-article'
  *           description: The id of the document.
  *         text:
  *           type: string
  *           example: |
  *             Machine learning is a subset of artificial intelligence that involves
  *             the use of algorithms and statistical models.
  *           description: The text content of the retrieved chunk.
  *         metadata:
  *           type: object
  *           description: JSON metadata associated with the document.
  *         size:
  *           type: integer
  *           example: 116
  *           description: Character length of text.
  *         tokens:
  *           type: integer
  *           example: 19
  *           description: Number of tokens.
  *         score:
  *           type: number
  *           example: 0.78
  *           description: Relevance score.
  *
  *     NewChunkQuery:
  *       type: object
  *       required:
  *         - query
  *       properties:
  *         agent_id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'website-agent'
  *           description: The id of the agent.
  *         datasource_ids:
  *           type: array
  *           items:
  *             type: string
  *             pattern: '^[a-zA-Z0-9_-]+$'
  *             maxLength: 255
  *             example: 'website-agent'
  *           description: An array of datasource ids.
  *         query:
  *           type: string
  *           example: 'What is machine learning?'
  *           description: User prompt input query.
  *         max_tokens:
  *           type: integer
  *           example: 250
  *           description: Retrieve chunks up to max tokens.
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
  * /v1/retrieve/chunks:
  *   post:
  *     tags:
  *       - Retrieval
  *     summary: Query chunks
  *     description: |
  *       Perform a query on a set of datasources or agent.
  *       Return relevant chunks for Retrieval Augmented Generation prompting.
  *       You may query a agent, a set of datasources, or both.
  *     requestBody:
  *       description: Query properties.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/NewChunkQuery'
  *     responses:
  *       '200':
  *         description: Information retrieved
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   description: |
  *                     A list of retrieved chunks, order by most relevant to less relevant
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/Chunk'
  *                 meta:
  *                   type: object
  *                   properties:
  *                     processing_time_ms:
  *                        type: integer
  *                        description: Time required to process the request in milliseconds.
  *                        example: 752
  *                     query:
  *                        type: string
  *                        description: The initial requested query
  *                        example: 'What is machine learning?'
  *                     transaction_id:
  *                        type: string
  *                        description: A transaction identifier
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
    '/retrieve/chunks',
    apiRoute(async (req, res) => {
      const now = Date.now();
      const payload = req.body.data;

      const datasourceIds = await findDatasourceIds({
        organization: req.organization,
        agentId: payload.agent_id,
        datasourceIds: payload.datasource_ids,
      });

      if (_.isEmpty(datasourceIds)) {
        badRequestResponse(req, res, 'No datasources found. Specify agent_id, datasource_ids, or both');
        return;
      }

      // Initiate Rag Log object
      const ragLog = new TreeNode({
        type: 'retrieve:chunks:request',
        timestamp: now,
        request: payload,
      });
      req.ragLog = ragLog;

      const { costUSD, chunks } = await retrieveChunks({
        organization: req.organization,
        datasourceIds,
        prompt: payload.query,
        maxTokens: payload.max_tokens,
        maxChars: payload.max_chars,
        maxChunks: payload.max_chunks,
        ragLog,
      });

      const finalResponse = {
        data: chunks,
        meta: {
          query: payload.query,
          processing_time_ms: Date.now() - now,
          transaction_id: req.transactionId,
        },
      };

      ragLog.addChild(new TreeNode({
        type: 'retrieve:chunks:response',
        response: finalResponse,
      }));

      req.transactionAction = 'retrieve_chunks';
      req.transactionCostUSD = costUSD;

      res.json(finalResponse);
    }),
  );
};
