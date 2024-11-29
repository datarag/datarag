const _ = require('lodash');
const { apiRoute, notFoundResponse } = require('../helpers/responses');
const { serializeConversation } = require('../helpers/serialize');
const db = require('../db/models');
const config = require('../config');
const { SCOPE_CHAT } = require('../scopes');

const MAX_CONVERSATIONS = config.get('chat:max:conversations');

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Conversation:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           example: 'abcd'
  *           description: A unique conversation id.
  *         title:
  *           type: string
  *           example: 'Help center inquiry'
  *           description: Auto-generated title of the conversation.
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: When conversation was last updated.
  */

  /**
   * @swagger
   * /v1/conversations:
   *   get:
   *     tags:
   *       - Generative AI
   *     summary: List conversations
   *     description: |
   *       Return a list of all the conversations associated with the API token.
   *
   *       **API Scope: `chat`**
   *     responses:
   *       '200':
   *         description: A list of conversations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Conversation'
   *       '401':
   *         description: Unauthorized access
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnauthorizedError'
   */
  router.get(
    '/conversations',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const conversations = await db.Conversation.findAll({
        where: {
          OrganizationId: req.organization.id,
          ApiKeyId: req.apiKey.id,
        },
        order: [['updatedAt', 'DESC']],
        limit: MAX_CONVERSATIONS,
      });

      res.json({
        data: _.map(conversations, (model) => serializeConversation(model)),
      });
    }),
  );

  /**
  * @swagger
  * /v1/conversations/{conversation_id}:
  *   get:
  *     tags:
  *       - Generative AI
  *     summary: Get conversation
  *     description: |
  *       Retrieve a specific conversation by its id.
  *
  *       **API Scope: `chat`**
  *
  *     parameters:
  *       - name: conversation_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A conversation object
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Conversation'
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
    '/conversations/:conversation_id',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const conversation = await db.Conversation.findOne({
        where: {
          OrganizationId: req.organization.id,
          ApiKeyId: req.apiKey.id,
          resId: req.params.conversation_id,
        },
      });
      if (!conversation) {
        notFoundResponse(req, res);
        return;
      }
      res.json({
        data: serializeConversation(conversation),
      });
    }),
  );

  /**
  * @swagger
  * /v1/conversations/{conversation_id}:
  *   delete:
  *     tags:
  *       - Generative AI
  *     summary: Delete conversation
  *     description: |
  *       Delete a specific conversation by its id.
  *
  *       **API Scope: `chat`**
  *     parameters:
  *       - name: conversation_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '204':
  *         description: Conversation deleted
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
    '/conversations/:conversation_id',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const conversation = await db.Conversation.findOne({
        where: {
          OrganizationId: req.organization.id,
          ApiKeyId: req.apiKey.id,
          resId: req.params.conversation_id,
        },
      });

      if (!conversation) {
        notFoundResponse(req, res);
        return;
      }
      await conversation.destroy();
      res.status(204).send();
    }),
  );

  /**
  * @swagger
  * /v1/conversations/{conversation_id}/turns:
  *   get:
  *     tags:
  *       - Generative AI
  *     summary: Get conversation turns
  *     description: |
  *       Retrieve the turns of a specific conversation by its id.
  *
  *       **API Scope: `chat`**
  *
  *     parameters:
  *       - name: conversation_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: A conversation object
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   type: array
  *                   items:
  *                     type: object
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
    '/conversations/:conversation_id/turns',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const conversation = await db.Conversation.findOne({
        where: {
          OrganizationId: req.organization.id,
          ApiKeyId: req.apiKey.id,
          resId: req.params.conversation_id,
        },
      });
      if (!conversation) {
        notFoundResponse(req, res);
        return;
      }
      res.json({
        data: conversation.history.turns,
      });
    }),
  );
};
