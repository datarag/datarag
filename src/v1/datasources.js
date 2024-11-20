const _ = require('lodash');
const { apiRoute, conflictResponse, notFoundResponse } = require('../helpers/responses');
const { serializeDatasource } = require('../helpers/serialize');
const { generateRandomHash } = require('../helpers/tokens');
const db = require('../db/models');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../scopes');

const { Op } = db.Sequelize;

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Datasource:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'help-center'
  *           description: A unique datasource id.
  *         name:
  *           type: string
  *           maxLength: 255
  *           example: 'Help center'
  *           description: The name of the datasource.
  *         purpose:
  *           type: string
  *           example: 'Contains help articles and HOW-TOs on using the product'
  *           description: |
  *             The purpose of this datasource. Please be as descriptive as possible so that LLMs
  *             have a good understanding about the content encapsulated.
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: Datasource creation datetime
  *
  *     NewDatasource:
  *       type: object
  *       required:
  *         - name
  *         - purpose
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'help-center'
  *           description: A unique datasource id, leave empty to auto-generate.
  *         name:
  *           type: string
  *           maxLength: 255
  *           example: 'Help center'
  *           description: The name of the datasource.
  *         purpose:
  *           type: string
  *           example: 'Contains help articles and HOW-TOs on using the product'
  *           description: |
  *             The purpose of this datasource. Please be as descriptive as possible so that LLMs
  *             have a good understanding about the content encapsulated.
  */

  /**
   * @swagger
   * /v1/datasources:
   *   get:
   *     tags:
   *       - Datasources
   *     summary: List datasources
   *     description: |
   *       Return a list of all the datasources accessible by the API token.
   *
   *       **API Scope: `data:read`**
   *     parameters:
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
   *         description: A list of datasources
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Datasource'
   *                 next_cursor:
   *                   type: string
   *                   description: The cursor for the next page of results.
   *       '401':
   *         description: Unauthorized access
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnauthorizedError'
   */
  router.get(
    '/datasources',
    apiRoute(SCOPE_DATA_READ, async (req, res) => {
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

      const datasources = await req.organization.getDatasources(queryOptions);
      const serializedDatasources = _.map(datasources, (model) => serializeDatasource(model));

      const response = {
        data: serializedDatasources,
      };

      if (datasources.length > 0 && datasources.length === limitNum) {
        response.next_cursor = datasources[datasources.length - 1].id;
      }

      res.json(response);
    }),
  );

  /**
   * @swagger
   * /v1/datasources:
   *   post:
   *     tags:
   *       - Datasources
   *     summary: Create new datasource
   *     description: |
   *       Create a new datasource (knowledge corpus).
   *       A datasource is referenced by a unique id.
   *       You may define the id or leave empty and a random unique id will
   *       be associated with the datasource.
   *
   *       **API Scope: `data:write`**
   *     requestBody:
   *       description: Datasource to be created.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - data
   *             properties:
   *               data:
   *                 $ref: '#/components/schemas/NewDatasource'
   *     responses:
   *       '200':
   *         description: Datasource created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Datasource'
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
   *       '409':
   *         description: Conflict
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Conflict'
   */
  router.post(
    '/datasources',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;
      const resId = payload.id;
      if (resId) {
        const [datasource, created] = await db.Datasource.findOrCreate({
          where: {
            OrganizationId: req.organization.id,
            resId,
          },
          defaults: {
            OrganizationId: req.organization.id,
            resId,
            name: payload.name,
            purpose: payload.purpose,
          },
        });
        if (!created) {
          conflictResponse(req, res);
          return;
        }

        res.json({
          data: serializeDatasource(datasource),
        });
        return;
      }

      const datasource = await db.Datasource.create({
        OrganizationId: req.organization.id,
        resId: `dsrc-${generateRandomHash()}`,
        name: payload.name,
        purpose: payload.purpose,
      });

      res.json({
        data: serializeDatasource(datasource),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}:
  *   get:
  *     tags:
  *       - Datasources
  *     summary: Get datasource
  *     description: |
  *       Retrieve a specific datasource by its id.
  *
  *       **API Scope: `data:read`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A datasource object
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Datasource'
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
    '/datasources/:datasource_id',
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
      res.json({
        data: serializeDatasource(datasource),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}:
  *   put:
  *     tags:
  *       - Datasources
  *     summary: Update datasource
  *     description: |
  *       Update a specific datasource by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Datasource data to update.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/Datasource'
  *     responses:
  *       '200':
  *         description: Datasource updated
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Datasource'
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
  *       '409':
  *         description: Conflict
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Conflict'
  */
  router.put(
    '/datasources/:datasource_id',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;
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

      const fields = {};
      if (!_.isUndefined(payload.name)) {
        fields.name = payload.name;
      }
      if (!_.isUndefined(payload.purpose)) {
        fields.purpose = payload.purpose;
      }

      if (payload.id && payload.id !== datasource.resId) {
        const existingDatasource = await db.Datasource.findOne({
          where: {
            OrganizationId: req.organization.id,
            resId: payload.id,
          },
        });
        if (existingDatasource) {
          conflictResponse(req, res);
          return;
        }
        fields.resId = payload.id;
      }

      await datasource.update(fields);

      res.json({
        data: serializeDatasource(datasource),
      });
    }),
  );

  /**
  * @swagger
  * /v1/datasources/{datasource_id}:
  *   delete:
  *     tags:
  *       - Datasources
  *     summary: Delete datasource
  *     description: |
  *       Delete a specific datasource by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: datasource_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '204':
  *         description: Datasource deleted
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
    '/datasources/:datasource_id',
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
      await datasource.destroy();
      res.status(204).send();
    }),
  );
};
