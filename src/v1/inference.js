const { nanoid } = require('nanoid');
const { apiRoute } = require('../helpers/responses');
const logger = require('../logger');
const openai = require('../llms/openai');
const cohere = require('../llms/cohere');
const { TreeNode } = require('../helpers/treenode');
const { SCOPE_CHAT } = require('../scopes');
const { LLM_CREATIVITY_LOW, LLM_QUALITY_HIGH } = require('../constants');

module.exports = (router) => {
  /**
  * @swagger
  * components:
  *   schemas:
  *     Inference:
  *       type: object
  *       properties:
  *         message:
  *           type: string
  *           example: |
  *             Machine learning is a subset of artificial intelligence that involves
  *             the use of algorithms and statistical models.
  *           description: The LLM message response.
  *
  *     NewInference:
  *       type: object
  *       required:
  *         - prompt
  *       properties:
  *         prompt:
  *           type: string
  *           example: 'What is machine learning?'
  *           description: LLM prompt.
  *         instructions:
  *           type: string
  *           example: 'You are a helpful assistant'
  *           description: LLM instructions.
  *         creativity:
  *           type: string
  *           example: 'none'
  *           default: 'low'
  *           enum: [none, low, medium, high]
  *           description: How creative the LLM should be (controls LLM temperature).
  *         quality:
  *           type: string
  *           example: 'high'
  *           default: 'high'
  *           enum: [medium, high]
  *           description: |
  *             Controls LLM selection to use,
  *             the higher the quality the more expensive model to use.
  */

  /**
  * @swagger
  * /v1/inference:
  *   post:
  *     tags:
  *       - Generative AI
  *     summary: Inference
  *     description: |
  *       Run a raw prompt over an LLM. Useful for one-off tasks
  *       like classification or other tasks that do not require RAG.
  *
  *       **API Scope: `chat`**
  *     requestBody:
  *       description: Generation properties.
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - data
  *             properties:
  *               data:
  *                 $ref: '#/components/schemas/NewInference'
  *     responses:
  *       '200':
  *         description: LLM response
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 data:
  *                   $ref: '#/components/schemas/Inference'
  *                 meta:
  *                   type: object
  *                   properties:
  *                     processing_time_ms:
  *                        type: integer
  *                        description: Time required to process the request in milliseconds.
  *                        example: 752
  *                     prompt:
  *                        type: string
  *                        description: The initial requested prompt.
  *                        example: 'What is machine learning?'
  *                     model:
  *                        type: string
  *                        description: The LLM model used for inference.
  *                        example: 'gpt-4o'
  *                     transaction_id:
  *                        type: string
  *                        description: A transaction identifier.
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
    '/inference',
    apiRoute(SCOPE_CHAT, async (req, res) => {
      const now = Date.now();
      const uuid = nanoid();

      const log = (message) => {
        logger.info(`Inference / ${req.organization.resId} / ${uuid}`, message);
      };

      const payload = req.body.data;

      if (!payload.creativity) {
        payload.creativity = LLM_CREATIVITY_LOW;
      }
      if (!payload.quality) {
        payload.quality = LLM_QUALITY_HIGH;
      }

      log('Inference started');

      // Initiate RAG log object
      const ragLog = new TreeNode({
        type: 'inference',
        timestamp: now,
        request: payload,
      });
      ragLog.startMeasure();
      req.ragLog = ragLog;

      let inferenceResponse;

      try {
        inferenceResponse = await openai.inference({
          text: payload.prompt,
          instructions: payload.instructions,
          creativity: payload.creativity,
          quality: payload.quality,
        });
      } catch (err) {
        inferenceResponse = await cohere.inference({
          text: payload.prompt,
          instructions: payload.instructions,
          creativity: payload.creativity,
          quality: payload.quality,
        });
      }

      const finalResponse = {
        data: {
          message: inferenceResponse.output,
        },
        meta: {
          prompt: payload.prompt,
          processing_time_ms: Date.now() - now,
          transaction_id: req.transactionId,
          model: inferenceResponse.model,
        },
      };

      ragLog.appendData({
        response: finalResponse,
      });
      ragLog.endMeasure();

      req.transactionAction = 'inference';
      req.transactionCostUSD = inferenceResponse.costUSD;

      res.json(finalResponse);
    }),
  );
};
