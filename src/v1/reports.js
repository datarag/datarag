const zlib = require('zlib');
const _ = require('lodash');
const { apiRoute, notFoundResponse } = require('../helpers/responses');
const db = require('../db/models');
const { serializeDocument, serializeDatasource } = require('../helpers/serialize');

const { Op } = db.Sequelize;

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     RagLog:
  *       type: object
  *       properties:
  *         dt:
  *           type: object
  *           description: Data object with key/value properties.
  *         cld:
  *           type: array
  *           description: A list of nested children.
  *           items:
  *             $ref: '#/components/schemas/RagLog'
  *
  *     Transaction:
  *       type: object
  *       properties:
  *         rag_log:
  *           $ref: '#/components/schemas/RagLog'
  *         chunks:
  *           type: array
  *           description: A list of chunks referenced in the rag_log object.
  *           items:
  *             type: object
  *             properties:
  *               chunk_ref:
  *                 type: string
  *                 example: '536'
  *                 description: The ref id of the chunk.
  *               text:
  *                 type: string
  *                 example: |
  *                   Machine learning is a subset of artificial intelligence that involves
  *                   the use of algorithms and statistical models.
  *                 description: The text content of the chunk.
  *         documents:
  *           type: array
  *           description: A list of documents referenced in the rag_log object.
  *           items:
  *             type: object
  *             properties:
  *               document_ref:
  *                 type: string
  *                 example: '536'
  *                 description: The ref id of the document
  *               document:
  *                 $ref: '#/components/schemas/Document'
  *         datasources:
  *           type: array
  *           description: A list of datasources referenced in the rag_log object.
  *           items:
  *             type: object
  *             properties:
  *               datasource_ref:
  *                 type: string
  *                 example: '536'
  *                 description: The ref id of the datasource
  *               datasource:
  *                 $ref: '#/components/schemas/Document'
  */

  /**
   * @swagger
   * /v1/transactions/{transaction_id}:
   *   get:
   *     tags:
   *       - Reports & Logs
   *     summary: Get transaction
   *     description: |
   *        Return the details of a retrieval or chat transaction based on `transaction_id` returned
   *        on the meta response of the relevant API endpoints.
   *
   *        The use case is for debugging RAG operations.
   *
   *        The details contain the reasoning logic of the RAG operation, including:
   *        - Request data
   *        - Retrieval logic
   *        - Response data
   *
   *        **Can only be queried by the same API token used to generate the transaction, for
   *        privacy reasons.**
   *
   *        RAG logs should be enabled and be available
   *        within the retention period of the logs, otherwise 404 will be returned.
   *
   *        Also, please note that transaction history is stored in an async way. That means
   *        that the transaction log might be available a few seconds after the transaction has
   *        completed.
   *     parameters:
   *       - name: transaction_id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Transaction details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Transaction'
   *       '401':
   *         description: Unauthorized access
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnauthorizedError'
   *       '404':
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotfoundError'
   */
  router.get(
    '/transactions/:transaction_id',
    apiRoute(async (req, res) => {
      const ragLog = await db.RagLog.findOne({
        where: {
          OrganizationId: req.organization.id,
          ApiKeyId: req.apiKey.id,
          transactionId: req.params.transaction_id,
        },
      });
      if (!ragLog) {
        notFoundResponse(req, res);
        return;
      }

      const decompressedData = await new Promise((resolve, reject) => {
        zlib.brotliDecompress(ragLog.compressedLog, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const data = JSON.parse(decompressedData.toString());

      // Find relevant refs
      let chunksRefs = {};
      let documentRefs = {};
      let datasourceRefs = {};
      function locateChunks(node) {
        if (!node || !node.dt) return;
        if (node.dt.chunk_ref) {
          chunksRefs[node.dt.chunk_ref] = true;
        }
        if (node.dt.document_ref) {
          documentRefs[node.dt.document_ref] = true;
        }
        if (node.dt.datasource_ref) {
          datasourceRefs[node.dt.datasource_ref] = true;
        }
        _.each(node.cld, (child) => locateChunks(child));
      }
      locateChunks(data);

      chunksRefs = _.keys(chunksRefs);
      documentRefs = _.keys(documentRefs);
      datasourceRefs = _.keys(datasourceRefs);

      const chunks = await db.Chunk.findAll({
        where: {
          OrganizationId: req.organization.id,
          id: {
            [Op.in]: chunksRefs,
          },
        },
      });

      const documents = await db.Document.findAll({
        where: {
          OrganizationId: req.organization.id,
          id: {
            [Op.in]: documentRefs,
          },
        },
      });

      const datasources = await db.Datasource.findAll({
        where: {
          OrganizationId: req.organization.id,
          id: {
            [Op.in]: datasourceRefs,
          },
        },
      });

      res.json({
        data: {
          rag_log: data,
          chunks: _.map(chunks, (model) => ({
            chunk_ref: model.id,
            text: model.content,
          })),
          documents: _.map(documents, (model) => ({
            document_ref: model.id,
            document: serializeDocument(model),
          })),
          datasources: _.map(datasources, (model) => ({
            datasource_ref: model.id,
            datasource: serializeDatasource(model),
          })),
        },
      });
    }),
  );
};
