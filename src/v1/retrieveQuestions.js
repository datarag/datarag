const _ = require('lodash');
const { apiRoute, badRequestResponse } = require('../helpers/responses');
const { findDatasourceIds, retrieveQuestions } = require('./retrieveCommon');
const { TreeNode } = require('../helpers/treenode');
const { SCOPE_RETRIEVAL } = require('../scopes');

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Question:
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
  *             What are applications of machine learning?
  *           description: The text content of the retrieved question.
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
  *     NewQuestionQuery:
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
  *         max_questions:
  *           type: integer
  *           example: 10
  *           description: Limit of questions to retrieve (top_k).
  */

  /**
  * @swagger
  * /v1/retrieve/questions:
  *   post:
  *     tags:
  *       - Retrieval
  *     summary: Query question bank
  *     description: |
  *       Perform a query on a set of datasources or agent.
  *       Return questions answered by the knowledge base relevant to user question.
  *       You may query a agent, a set of datasources, or both.
  *
  *       **API Scope: `retrieval`**
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
  *                 $ref: '#/components/schemas/NewQuestionQuery'
  *     responses:
  *       '200':
  *         description: Relevant questions retrieved
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   description: |
  *                     A list of retrieved questions, order by most relevant to less relevant
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/Question'
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
    '/retrieve/questions',
    apiRoute(SCOPE_RETRIEVAL, async (req, res) => {
      const now = Date.now();
      const payload = req.body.data;

      const datasourceIds = await findDatasourceIds({
        organization: req.organization,
        agentResId: payload.agent_id,
        datasourceResIds: payload.datasource_ids,
      });

      if (_.isEmpty(datasourceIds)) {
        badRequestResponse(req, res, 'No datasources found. Specify agent_id, datasource_ids, or both');
        return;
      }

      // Initiate Rag Log object
      const ragLog = new TreeNode({
        type: 'retrieve_questions',
        timestamp: now,
        request: payload,
      });
      ragLog.startMeasure();
      req.ragLog = ragLog;

      const { costUSD, chunks } = await retrieveQuestions({
        organization: req.organization,
        datasourceIds,
        prompt: payload.query,
        maxChunks: payload.max_questions,
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

      ragLog.appendData({
        response: finalResponse,
      });
      ragLog.endMeasure();

      req.transactionAction = 'retrieve_questions';
      req.transactionCostUSD = costUSD;

      res.json(finalResponse);
    }),
  );
};
