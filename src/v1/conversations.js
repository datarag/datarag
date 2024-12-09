const _ = require('lodash');
const { nanoid } = require('nanoid');
const {
  apiRoute,
  notFoundResponse,
  conflictResponse,
  badRequestResponse,
} = require('../helpers/responses');
const { serializeConversation, serializeTurn } = require('../helpers/serialize');
const db = require('../db/models');
const config = require('../config');
const { SCOPE_CHAT } = require('../scopes');
const md5 = require('../helpers/md5');
const { convertSource } = require('../helpers/converter');
const indexDocument = require('../queue/jobs/indexDocument');

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
  *
  *     NewConversation:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           pattern: '^[a-zA-Z0-9_-]+$'
  *           maxLength: 255
  *           example: 'conversation-1'
  *           description: A unique conversation id, leave empty to auto-generate.
  *         title:
  *           type: string
  *           maxLength: 255
  *           example: 'Help center inquiry'
  *           description: Auto-generated title of the conversation.
  *
  *     Turn:
  *       type: object
  *       properties:
  *         id:
  *           type: string
  *           example: 'abcd'
  *           description: A unique turn id.
  *         payload:
  *           type: object
  *           description: JSON data associated with this turn. Contains the /chat response.
  *         metadata:
  *           type: object
  *           description: JSON metadata associated with this turn.
  *         tokens:
  *           type: integer
  *           example: 24
  *           description: Number of tokens (input / output) on this turn.
  *         date:
  *           type: string
  *           example: '2024-11-20T06:50:31.958Z'
  *           description: When turn was created.
  *
  *     TrainDocument:
  *       type: object
  *       required:
  *         - type
  *         - content
  *       properties:
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
   * /v1/conversations:
   *   post:
   *     tags:
   *       - Generative AI
   *     summary: Create new conversation
   *     description: |
   *       Create a new conversation to be used in Chat.
   *
   *       **API Scope: `chat`**
   *     requestBody:
   *       description: Conversation to be created.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - data
   *             properties:
   *               data:
   *                 $ref: '#/components/schemas/NewConversation'
   *     responses:
   *       '200':
   *         description: Conversation created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Conversation'
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
    '/conversations',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const payload = req.body.data;
      const resId = payload.id;
      if (resId) {
        const [conversation, created] = await db.Conversation.findOrCreate({
          where: {
            OrganizationId: req.organization.id,
            ApiKeyId: req.apiKey.id,
            resId,
          },
          defaults: {
            OrganizationId: req.organization.id,
            ApiKeyId: req.apiKey.id,
            resId,
            title: payload.title || '',
          },
        });
        if (!created) {
          conflictResponse(req, res);
          return;
        }

        res.json({
          data: serializeConversation(conversation),
        });
        return;
      }

      const conversation = await db.Conversation.create({
        OrganizationId: req.organization.id,
        ApiKeyId: req.apiKey.id,
        resId: `conv-${nanoid()}`,
        title: payload.title || '',
      });

      res.json({
        data: serializeConversation(conversation),
      });
    }),
  );

  /**
  * @swagger
  * /v1/conversations/{conversation_id}:
  *   put:
  *     tags:
  *       - Generative AI
  *     summary: Update conversation
  *     description: |
  *       Update a specific conversation by its id.
  *
  *       **API Scope: `chat`**
  *     parameters:
  *       - name: conversation_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Conversation data to update.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/NewConversation'
  *     responses:
  *       '200':
  *         description: Conversation updated
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Conversation'
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
    '/conversations/:conversation_id',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const payload = req.body.data;
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

      const fields = {};
      if (!_.isUndefined(payload.title)) {
        fields.title = payload.title;
      }

      if (payload.id && payload.id !== conversation.resId) {
        const existingConversation = await db.Conversation.findOne({
          where: {
            OrganizationId: req.organization.id,
            ApiKeyId: req.apiKey.id,
            resId: payload.id,
          },
        });
        if (existingConversation) {
          conflictResponse(req, res);
          return;
        }
        fields.resId = payload.id;
      }

      await conversation.update(fields);

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
  *                     $ref: '#/components/schemas/Turn'
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

      const turns = await conversation.getTurns({
        order: [['createdAt', 'ASC']],
      });

      res.json({
        data: _.map(turns, (turn) => serializeTurn(turn)),
      });
    }),
  );

  /**
  * @swagger
  * /v1/conversations/{conversation_id}/train:
  *   post:
  *     tags:
  *       - Generative AI
  *     summary: Train conversation
  *     description: |
  *       Add a document as knowledge context to the conversation.
  *
  *       **API Scope: `chat`**
  *     parameters:
  *       - name: conversation_id
  *         in: path
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       description: Document to be added.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/TrainDocument'
  *     responses:
  *       '204':
  *         description: Conversation trained
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
    '/conversations/:conversation_id/train',
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

      const payload = req.body.data;

      // Original content
      const contentSource = payload.content;
      // Markdown content
      let content;

      try {
        content = await convertSource({
          content: payload.content,
          type: payload.type,
        });
      } catch (err) {
        badRequestResponse(req, res, 'Provided URL is invalid or unreachable');
        return;
      }

      if (!content) {
        badRequestResponse(req, res, 'Could not process content');
        return;
      }

      const [datasource] = await db.Datasource.findOrCreate({
        where: {
          OrganizationId: req.organization.id,
          ConversationId: conversation.id,
        },
        defaults: {
          OrganizationId: req.organization.id,
          ConversationId: conversation.id,
          resId: `dsrc-${conversation.resId}`,
          name: conversation.resId,
          purpose: conversation.title || '',
        },
      });

      const fields = {
        OrganizationId: req.organization.id,
        DatasourceId: datasource.id,
        resId: `doc-conv-${nanoid()}`,
        name: '',
        content,
        contentSource,
        contentType: payload.type,
        contentHash: md5(content),
        contentSize: content.length,
        metadata: payload.metadata || {},
        status: 'queued',
      };

      // Check for existing document
      let document = await db.Document.findOne({
        where: {
          OrganizationId: fields.OrganizationId,
          DatasourceId: fields.DatasourceId,
          contentHash: fields.contentHash,
        },
      });

      if (!document) {
        document = await db.Document.create({
          ...fields,
        });

        await indexDocument({
          document_id: document.id,
          knowledge: 'shallow',
        });
      }

      res.status(204).send();
    }),
  );
};
