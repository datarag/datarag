const _ = require('lodash');
const { apiRoute, badRequestResponse } = require('../helpers/responses');
const { findDatasourceIds, retrieveDocuments, createSnippets } = require('./retrieveCommon');
const { TreeNode } = require('../helpers/treenode');

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     NewDocumentQuery:
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
  *         snippets:
  *           type: boolean
  *           example: true
  *           default: false
  *           description: |
  *             Whether the response should generate full text search snippets in the meta response.
  *         max_documents:
  *           type: integer
  *           example: 10
  *           default: 100
  *           description: Limit of documents to retrieve (top_k).
  */

  /**
  * @swagger
  * /v1/retrieve/documents:
  *   post:
  *     tags:
  *       - Retrieval
  *     summary: Query documents
  *     description: |
  *       Perform a query on a set of datasources or agent.
  *       Return relevant documents for search functionality.
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
  *                 $ref: '#/components/schemas/NewDocumentQuery'
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
  *                     A list of retrieved documents
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/Document'
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
  *                     snippets:
  *                        type: array
  *                        items:
  *                          type: string
  *                          example: and <b>machine learning</b> is...
  *                        description: |
  *                          One on one mapping with retrieved documents,
  *                          if "snippets" is set to true. Highlighted terms will be
  *                          encapsulated inside `<b>`term`</b>` markup.
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
    '/retrieve/documents',
    apiRoute(async (req, res) => {
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

      // Initiate Rag log object
      const ragLog = new TreeNode({
        type: 'retrieve_documents',
        timestamp: now,
        request: payload,
      });
      ragLog.startMeasure();
      req.ragLog = ragLog;

      const { costUSD, documents, documentIds } = await retrieveDocuments({
        organization: req.organization,
        datasourceIds,
        prompt: payload.query,
        maxDocuments: payload.max_documents > 0 ? payload.max_documents : 100,
        ragLog,
      });

      let snippets;

      if (payload.snippets) {
        snippets = await createSnippets({
          organization: req.organization,
          prompt: payload.query,
          documentIds,
        });
      }

      const finalResponse = {
        data: documents,
        meta: {
          query: payload.query,
          processing_time_ms: Date.now() - now,
          transaction_id: req.transactionId,
          snippets,
        },
      };

      ragLog.appendData({
        response: finalResponse,
      });
      ragLog.endMeasure();

      req.transactionAction = 'retrieve_documents';
      req.transactionCostUSD = costUSD;

      res.json(finalResponse);
    }),
  );
};
