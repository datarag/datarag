const _ = require('lodash');
const { apiRoute, notFoundResponse, badRequestResponse } = require('../helpers/responses');
const { serializeConnector } = require('../helpers/serialize');
const { generateRandomHash } = require('../helpers/tokens');
const db = require('../db/models');
const { convertToFunctionName, isSafeUrl } = require('../helpers/utils');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../scopes');

const { Op } = db.Sequelize;

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Connector:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'database-wrapper-api'
  *           description: A unique connector id.
  *         name:
  *           type: string
  *           example: 'Query sales report'
  *           description: The name of the connector.
  *         purpose:
  *           type: string
  *           example: 'Connects to a database to retrieve sales information for a given period.'
  *           description: |
  *             A verbose description of the connector.
  *             Make it as descriptive as possible, so that LLM has a good understanding
  *             of the content to be retrieved.
  *         endpoint:
  *           type: string
  *           example: 'https://api.example.com'
  *           description: Connector API endpoint.
  *         method:
  *           type: string
  *           example: 'post'
  *           description: Endpoint HTTP method to use.
  *           enum: ['get', 'post', 'put', 'patch']
  *         payload:
  *           type: object
  *           description: API payload parameters.
  *           additionalProperties: true
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: Connector creation datetime
  *         metadata:
  *           type: object
  *           description: JSON metadata associated with the connector.
  *           additionalProperties: true
  *
  *     NewConnector:
  *       type: object
  *       required:
  *         - name
  *         - purpose
  *         - endpoint
  *         - payload
  *         - method
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'database-wrapper-api'
  *           description: A unique connector id, leave empty to auto-generate.
  *         name:
  *           type: string
  *           example: 'Query sales report'
  *           description: The name of the connector.
  *         purpose:
  *           type: string
  *           example: 'Connects to a database to retrieve sales information for a given period.'
  *           description: |
  *             A verbose description of the connector.
  *             Make it as descriptive as possible, so that LLM has a good understanding
  *             of the content to be retrieved.
  *         endpoint:
  *           type: string
  *           format: uri
  *           pattern: '^https?://'
  *           example: 'https://api.example.com'
  *           description: Connector API endpoint.
  *         method:
  *           type: string
  *           example: 'post'
  *           description: Endpoint HTTP method to use.
  *           enum: ['get', 'post', 'put', 'patch']
  *         payload:
  *           type: object
  *           description: API payload parameters.
  *           additionalProperties:
  *             type: object
  *             required:
  *               - description
  *               - type
  *               - required
  *             properties:
  *               description:
  *                 type: string
  *                 example: 'Retrieves sales info for a day, in YYYY-MM-DD format'
  *                 description: A versobe documentation of what this parameter is about.
  *               type:
  *                 type: string
  *                 enum: ['str', 'number', 'bool']
  *                 example: 'str'
  *                 description: Describes the parameter type.
  *               required:
  *                 type: boolean
  *                 example: true
  *                 description: Whether this is a required parameter.
  *         metadata:
  *           type: object
  *           description: JSON metadata associated with the connector.
  *           additionalProperties: true
  */

  /**
   * @swagger
   * /v1/datasources/{datasource_id}/connectors:
   *   get:
   *     tags:
   *       - Datasources ➝ Connectors
   *     summary: List connectors
   *     description: |
   *       Return a list of all the datasource connectors accessible by the API token.
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
   *         description: A list of connectors
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Connector'
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
    '/datasources/:datasource_id/connectors',
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

      const connectors = await datasource.getConnectors(queryOptions);
      const serializedConnectors = _.map(connectors, (model) => serializeConnector(model));

      const response = {
        data: serializedConnectors,
      };

      if (connectors.length > 0 && connectors.length === limitNum) {
        response.next_cursor = connectors[connectors.length - 1].id;
      }

      res.json(response);
    }),
  );

  /**
   * @swagger
   * /v1/datasources/{datasource_id}/connectors:
   *   post:
   *     tags:
   *       - Datasources ➝ Connectors
   *     summary: Create/Update connector
   *     description: |
   *       Create or update a datasource connector.
   *       A connector is referenced by a unique id.
   *       You may define the id or leave empty and a random unique id will
   *       be associated with the connector. If a connector with the same
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
   *       description: Connector to be created.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - data
   *             properties:
   *               data:
   *                 $ref: '#/components/schemas/NewConnector'
   *     responses:
   *       '200':
   *         description: Connector created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Connector'
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
    '/datasources/:datasource_id/connectors',
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

      const payload = req.body.data;
      const resId = payload.id;

      if (!(await isSafeUrl(payload.endpoint))) {
        badRequestResponse(req, res, 'Provided endpoint URL is invalid or unreachable');
        return;
      }

      const fields = {
        OrganizationId: req.organization.id,
        DatasourceId: datasource.id,
        resId: resId || `conn-${generateRandomHash()}`,
        name: payload.name,
        purpose: payload.purpose,
        endpoint: payload.endpoint,
        method: payload.method,
        payload: payload.payload || {},
        function: convertToFunctionName(payload.name),
        metadata: payload.metadata || {},
      };

      // Check for existing connector
      let connector = resId ? await db.Connector.findOne({
        where: {
          OrganizationId: fields.OrganizationId,
          DatasourceId: fields.DatasourceId,
          resId: fields.resId,
        },
      }) : null;
      if (connector) {
        await connector.update(fields);
      } else {
        connector = await db.Connector.create({
          ...fields,
        });
      }

      res.json({
        data: serializeConnector(connector),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}/connectors/{connector_id}:
  *   get:
  *     tags:
  *       - Datasources ➝ Connectors
  *     summary: Get connector
  *     description: |
  *       Retrieve a specific datasource connector by its id.
  *
  *       **API Scope: `data:read`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *       - name: connector_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A connector object
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Connector'
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
    '/datasources/:datasource_id/connectors/:connector_id',
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

      const connector = await db.Connector.findOne({
        where: {
          OrganizationId: req.organization.id,
          DatasourceId: datasource.id,
          resId: req.params.connector_id,
        },
      });
      if (!connector) {
        notFoundResponse(req, res);
        return;
      }
      res.json({
        data: serializeConnector(connector),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}/connectors/{connector_id}:
  *   delete:
  *     tags:
  *       - Datasources ➝ Connectors
  *     summary: Delete connector
  *     description: |
  *       Delete a specific datasource connector by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *       - name: connector_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '204':
  *         description: Connector deleted
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
    '/datasources/:datasource_id/connectors/:connector_id',
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

      const connector = await db.Connector.findOne({
        where: {
          OrganizationId: req.organization.id,
          DatasourceId: datasource.id,
          resId: req.params.connector_id,
        },
      });
      if (!connector) {
        notFoundResponse(req, res);
        return;
      }

      await connector.destroy();
      res.status(204).send();
    }),
  );
};
