const _ = require('lodash');
const { apiRoute, notFoundResponse, badRequestResponse } = require('../helpers/responses');
const { serializeDocument } = require('../helpers/serialize');
const { generateRandomHash } = require('../helpers/tokens');
const md5 = require('../helpers/md5');
const db = require('../db/models');
const { addJob } = require('../queue');
const logger = require('../logger');
const { fetchAndCleanHtml } = require('../helpers/utils');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../scopes');

const { Op } = db.Sequelize;

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Document:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'help-center-article'
  *           description: A unique document id.
  *         name:
  *           type: string
  *           maxLength: 255
  *           example: 'Help center article'
  *           description: The name of the document.
  *         type:
  *           type: string
  *           enum: [text, pdf, url, html, markdown]
  *           example: 'text'
  *           description: The type of the document.
  *         status:
  *           type: string
  *           enum: [queued, indexing, indexed, failed]
  *           example: 'queued'
  *           description: Document type.
  *         hash:
  *           type: string
  *           example: 'f38de0635d1d97cf34aa9dcb143b54a5'
  *           description: Document hash.
  *         size:
  *           type: integer
  *           example: 50234
  *           description: Document size in bytes.
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: Document creation datetime
  *         metadata:
  *           type: object
  *           description: |
  *             JSON metadata associated with the document.
  *             May be passed to LLMs as additional context.
  *           additionalProperties: true
  *
  *     NewDocument:
  *       type: object
  *       required:
  *         - name
  *         - type
  *         - content
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'help-center-article'
  *           description: A unique document id, leave empty to auto-generate.
  *         name:
  *           type: string
  *           maxLength: 255
  *           example: 'Help center article'
  *           description: The name of the document.
  *         type:
  *           type: string
  *           enum: [text, pdf, url, html, markdown]
  *           example: 'text'
  *           description: The type of the document.
  *         content:
  *           type: string
  *           example: 'This is the content of an article'
  *           description: Document content. For pdf, use base64 encoding.
  *         metadata:
  *           type: object
  *           description: |
  *             JSON metadata associated with the document.
  *             May be passed to LLMs as additional context.
  *           additionalProperties: true
  */

  /**
   * @swagger
   * /v1/datasources/{datasource_id}/documents:
   *   get:
   *     tags:
   *       - Datasources ➝ Documents
   *     summary: List documents
   *     description: |
   *       Return a list of all the datasource documents accessible by the API token.
   *
   *       **API Scope: `data:read`**
   *     parameters:
   *       - name: datasource_id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: cursor
   *         schema:
   *           type: string
   *         description: Cursor for pagination.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *           maximum: 100
   *         description: Number of items to return per page.
   *     responses:
   *       '200':
   *         description: A list of documents
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Document'
   *                 next_cursor:
   *                   type: string
   *                   description: The cursor for the next page of results.
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
    '/datasources/:datasource_id/documents',
    apiRoute(SCOPE_DATA_READ, async (req, res) => {
      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.datasource_id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      const { cursor, limit = 100 } = req.query;
      const limitNum = parseInt(limit, 10);

      const queryOptions = {
        order: [['id', 'ASC']],
        limit: limitNum,
      };

      if (cursor) {
        queryOptions.where = {
          id: {
            [Op.gt]: cursor,
          },
        };
      }

      const documents = await datasource.getDocuments(queryOptions);
      const serializedDocuments = _.map(documents, (model) => serializeDocument(model));

      const response = {
        data: serializedDocuments,
      };

      if (documents.length > 0 && documents.length === limitNum) {
        response.next_cursor = documents[documents.length - 1].id;
      }

      res.json(response);
    }),
  );

  /**
   * @swagger
   * /v1/datasources/{datasource_id}/documents:
   *   post:
   *     tags:
   *       - Datasources ➝ Documents
   *     summary: Create/Update document
   *     description: |
   *       Upload a datasource document.
   *       A document is referenced by a unique id.
   *       You may define the id or leave empty and a random unique id will
   *       be associated with the document. If a document with the same
   *       id already exists, it is updated
   *
   *       **API Scope: `data:write`**
   *     parameters:
   *       - name: datasource_id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       description: Document to be created.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - data
   *             properties:
   *               data:
   *                 $ref: '#/components/schemas/NewDocument'
   *     responses:
   *       '200':
   *         description: Document created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Document'
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
   *       '404':
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotfoundError'
   */
  router.post(
    '/datasources/:datasource_id/documents',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.datasource_id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      let mustIndex = true;
      const payload = req.body.data;
      const resId = payload.id;

      let { content } = payload;
      if (payload.type === 'url') {
        try {
          content = await fetchAndCleanHtml(payload.content);
        } catch (err) {
          badRequestResponse(req, res, 'Provided URL is invalid or unreachable');
          return;
        }
      }

      const fields = {
        OrganizationId: req.organization.id,
        DatasourceId: datasource.id,
        resId: resId || `doc-${generateRandomHash()}`,
        name: payload.name,
        content,
        contentType: payload.type,
        contentHash: md5(payload.content),
        contentSize: payload.content.length,
        metadata: payload.metadata || {},
      };

      // Check for existing document
      let document = resId ? await db.Document.findOne({
        where: {
          OrganizationId: fields.OrganizationId,
          DatasourceId: fields.DatasourceId,
          resId: fields.resId,
        },
      }) : null;
      if (document) {
        const isNew = (
          (fields.contentHash !== document.contentHash)
          || (fields.contentType !== document.contentType)
          || document.status === 'failed');

        await document.update(fields);

        if (isNew) {
          await document.update({
            status: 'queued',
          });
        } else {
          mustIndex = false;
        }
      } else {
        document = await db.Document.create({
          ...fields,
          status: 'queued',
        });
      }

      if (mustIndex) {
        // Add to queue
        logger.info(`document:${document.id}`, 'Add to queue');
        await addJob(`index:document:${document.id}`, {
          type: 'index',
          document_id: document.id,
        });
      } else {
        logger.info(`document:${document.id}`, 'Skip queue');
      }

      res.json({
        data: serializeDocument(document),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}/documents/{document_id}:
  *   get:
  *     tags:
  *       - Datasources ➝ Documents
  *     summary: Get document
  *     description: |
  *       Retrieve a specific datasource document by its id.
  *
  *       **API Scope: `data:read`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *       - name: document_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A document object
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Document'
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
    '/datasources/:datasource_id/documents/:document_id',
    apiRoute(SCOPE_DATA_READ, async (req, res) => {
      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.datasource_id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      const document = await db.Document.findOne({
        where: {
          OrganizationId: req.organization.id,
          DatasourceId: datasource.id,
          resId: req.params.document_id,
        },
      });
      if (!document) {
        notFoundResponse(req, res);
        return;
      }
      res.json({
        data: serializeDocument(document),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}/documents/{document_id}:
  *   delete:
  *     tags:
  *       - Datasources ➝ Documents
  *     summary: Delete document
  *     description: |
  *       Delete a specific datasource document by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *       - name: document_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '204':
  *         description: Document deleted
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
  router.delete(
    '/datasources/:datasource_id/documents/:document_id',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.datasource_id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      const document = await db.Document.findOne({
        where: {
          OrganizationId: req.organization.id,
          DatasourceId: datasource.id,
          resId: req.params.document_id,
        },
      });
      if (!document) {
        notFoundResponse(req, res);
        return;
      }

      await document.destroy();
      res.status(204).send();
    }),
  );
};
