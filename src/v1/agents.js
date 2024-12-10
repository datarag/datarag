const _ = require('lodash');
const { nanoid } = require('nanoid');
const { apiRoute, conflictResponse, notFoundResponse } = require('../helpers/responses');
const { serializeAgent, serializeDatasource } = require('../helpers/serialize');
const db = require('../db/models');
const { SCOPE_DATA_READ, SCOPE_DATA_WRITE } = require('../scopes');
const { RESID_PREFIX_AGENT } = require('../constants');

const { Op } = db.Sequelize;

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Agent:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'website-agent'
  *           description: A unique agent id.
  *         name:
  *           type: string
  *           example: 'Website'
  *           description: The name of the agent.
  *         purpose:
  *           type: string
  *           example: 'A customer support agent that can find information on helpcenter and blogs.'
  *           description: |
  *             What this agent is all about.
  *             Make it as descriptive as possible, so that LLM has a good understanding
  *             of the functionality of the agent.
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: Agent creation datetime
  *
  *     UpdateAgent:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'website-agent'
  *           description: A unique agent id.
  *         name:
  *           type: string
  *           example: 'Website'
  *           description: The name of the agent.
  *         purpose:
  *           type: string
  *           example: 'A customer support agent that can find information on helpcenter and blogs.'
  *           description: |
  *             What this agent is all about.
  *             Make it as descriptive as possible, so that LLM has a good understanding
  *             of the functionality of the agent.
  *
  *     NewAgent:
  *       type: object
  *       required:
  *         - name
  *         - purpose
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'website-agent'
  *           description: A unique datasource id, leave empty to auto-generate.
  *         name:
  *           type: string
  *           example: 'Website'
  *           description: The name of the agent.
  *         purpose:
  *           type: string
  *           example: 'A customer support agent that can find information on helpcenter and blogs.'
  *           description: |
  *             What this agent is all about.
  *             Make it as descriptive as possible, so that LLM has a good understanding
  *             of the functionality of the agent.
  */

  /**
   * @swagger
   * /v1/agents:
   *   get:
   *     tags:
   *       - Agents
   *     summary: List agents
   *     description: |
   *       Return a list of all the agents accessible by the API token.
   *       An agent is a set of datasources grouped together.
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
   *         description: A list of agents
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Agent'
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
    '/agents',
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

      const agents = await req.organization.getAgents(queryOptions);
      const serializedAgents = _.map(agents, (model) => serializeAgent(model));

      const response = {
        data: serializedAgents,
      };

      if (agents.length > 0 && agents.length === limitNum) {
        response.next_cursor = agents[agents.length - 1].id;
      }

      res.json(response);
    }),
  );

  /**
   * @swagger
   * /v1/agents:
   *   post:
   *     tags:
   *       - Agents
   *     summary: Create new agent
   *     description: |
   *       Create a new agent of datasources.
   *       A agent is referenced by a unique id.
   *       You may define the id or leave empty and a random unique id will
   *       be associated with the agent.
   *
   *       **API Scope: `data:write`**
   *     requestBody:
   *       description: Agent to be created.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - data
   *             properties:
   *               data:
   *                 $ref: '#/components/schemas/NewAgent'
   *     responses:
   *       '200':
   *         description: Agent created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Agent'
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
    '/agents',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;
      const resId = payload.id;
      if (resId) {
        const [agent, created] = await db.Agent.findOrCreate({
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
          data: serializeAgent(agent),
        });
        return;
      }

      const agent = await db.Agent.create({
        OrganizationId: req.organization.id,
        resId: `${RESID_PREFIX_AGENT}${nanoid()}`,
        name: payload.name,
        purpose: payload.purpose,
      });

      res.json({
        data: serializeAgent(agent),
      });
    }),
  );

  /**
  * @swagger
  * /v1/agents/{agent_id}:
  *   get:
  *     tags:
  *       - Agents
  *     summary: Get agent
  *     description: |
  *       Retrieve a specific agent by its id.
  *
  *       **API Scope: `data:read`**
  *     parameters:
  *       - name: agent_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A agent object
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
    '/agents/:agent_id',
    apiRoute(SCOPE_DATA_READ, async (req, res) => {
      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
        notFoundResponse(req, res);
        return;
      }
      res.json({
        data: serializeAgent(agent),
      });
    }),
  );

  /**
  * @swagger
  * /v1/agents/{agent_id}:
  *   put:
  *     tags:
  *       - Agents
  *     summary: Update agent
  *     description: |
  *       Update a specific agent by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: agent_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Agent data to update.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/UpdateAgent'
  *     responses:
  *       '200':
  *         description: Agent updated
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Agent'
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
    '/agents/:agent_id',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;
      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
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

      if (payload.id && payload.id !== agent.resId) {
        const existingAgent = await db.Agent.findOne({
          where: {
            OrganizationId: req.organization.id,
            resId: payload.id,
          },
        });
        if (existingAgent) {
          conflictResponse(req, res);
          return;
        }
        fields.resId = payload.id;
      }

      await agent.update(fields);

      res.json({
        data: serializeAgent(agent),
      });
    }),
  );

  /**
  * @swagger
  * /v1/agents/{agent_id}:
  *   delete:
  *     tags:
  *       - Agents
  *     summary: Delete agent
  *     description: |
  *       Delete a specific agent by its id.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: agent_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '204':
  *         description: Agent deleted
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
    '/agents/:agent_id',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
        notFoundResponse(req, res);
        return;
      }
      await agent.destroy();
      res.status(204).send();
    }),
  );

  /**
  * @swagger
  * /v1/agents/{agent_id}/datasources:
  *   get:
  *     tags:
  *       - Agents ➝ Datasources
  *     summary: List datasources in agent
  *     description: |
  *       Get datasources associated with that agent.
  *
  *       **API Scope: `data:read`**
  *     parameters:
  *       - name: agent_id
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
  *         description: A list of agent datasources
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
  *       '404':
  *         description: Not found
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/NotfoundError'
  */
  router.get(
    '/agents/:agent_id/datasources',
    apiRoute(SCOPE_DATA_READ, async (req, res) => {
      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
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

      const datasources = await agent.getDatasources(queryOptions);
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
  * /v1/agents/{agent_id}/datasources:
  *   post:
  *     tags:
  *       - Agents ➝ Datasources
  *     summary: Add datasource to agent
  *     description: |
  *       Add datasource to agent.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: agent_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Datasource id to add.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 type: object
  *                 required:
  *                   - datasource
  *                 properties:
  *                   datasource:
  *                     type: object
  *                     required:
  *                       - id
  *                     properties:
  *                       id:
  *                         type: string
  *                         example: help-center-datasource
  *     responses:
  *       '204':
  *         description: Datasource added to agent
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
    '/agents/:agent_id/datasources',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;

      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
        notFoundResponse(req, res);
        return;
      }

      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: payload.datasource.id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      await db.AgentDatasource.findOrCreate({
        where: {
          AgentId: agent.id,
          DatasourceId: datasource.id,
        },
        defaults: {
          AgentId: agent.id,
          DatasourceId: datasource.id,
        },
      });

      res.status(204).send();
    }),
  );

  /**
  * @swagger
  * /v1/agents/{agent_id}/datasources:
  *   delete:
  *     tags:
  *       - Agents ➝ Datasources
  *     summary: Remove datasource from agent
  *     description: |
  *       Remove datasource from agent.
  *
  *       **API Scope: `data:write`**
  *     parameters:
  *       - name: agent_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Datasource id to remove from agent.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 type: object
  *                 required:
  *                   - datasource
  *                 properties:
  *                   datasource:
  *                     type: object
  *                     required:
  *                       - id
  *                     properties:
  *                       id:
  *                         type: string
  *                         example: help-center-datasource
  *     responses:
  *       '204':
  *         description: Datasource removed from agent
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
    '/agents/:agent_id/datasources',
    apiRoute(SCOPE_DATA_WRITE, async (req, res) => {
      const payload = req.body.data;

      const agent = await db.Agent.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: req.params.agent_id,
        },
      });
      if (!agent) {
        notFoundResponse(req, res);
        return;
      }

      const datasource = await db.Datasource.findOne({
        where: {
          OrganizationId: req.organization.id,
          resId: payload.datasource.id,
        },
      });
      if (!datasource) {
        notFoundResponse(req, res);
        return;
      }

      const model = await db.AgentDatasource.findOne({
        where: {
          AgentId: agent.id,
          DatasourceId: datasource.id,
        },
      });

      if (model) {
        await model.destroy();
      }

      res.status(204).send();
    }),
  );
};
