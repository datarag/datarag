/* eslint-disable no-loop-func */
const _ = require('lodash');
const db = require('../../db/models');
const logger = require('../../logger');
const config = require('../../config');
const cohere = require('../../llms/cohere');
const openai = require('../../llms/openai');
const { chunkifyMarkdown } = require('../../helpers/chunker');
const { LLM_CREATIVITY_NONE, LLM_QUALITY_MEDIUM } = require('../../constants');
const { createEmbeddings } = require('../../agents/createEmbeddings');
const summarizePrompt = require('../../prompts/summarizePrompt');

const DOCUMENT_TOKEN_SIZE = 32000;

/**
 * Summarize
 *
 * @param {*} { text }
 * @return {String}
 */
async function summarize({ text }) {
  let summary = '';
  let context = '';
  const faq = [];
  let costUSD = 0;

  const prompt = summarizePrompt({
    text,
  });

  let completion;

  try {
    completion = await openai.inference({
      text: prompt,
      creativity: LLM_CREATIVITY_NONE,
      quality: LLM_QUALITY_MEDIUM,
      json: true,
    });
  } catch (err) {
    logger.error('summarize:openai', err);

    try {
      completion = await cohere.inference({
        text: prompt,
        creativity: LLM_CREATIVITY_NONE,
        quality: LLM_QUALITY_MEDIUM,
        json: true,
      });
    } catch (err2) {
      logger.error('summarize:cohere', err2);
    }
  }

  if (_.isString(completion.output.summary)) {
    summary = completion.output.summary;
  }
  if (_.isString(completion.output.context)) {
    context = completion.output.context;
  }
  if (_.isArray(completion.output.faq)) {
    _.each(completion.output.faq, (entry) => {
      if (_.isString(entry.question) && _.isString(entry.answer)) {
        faq.push(entry);
      }
    });
  }

  costUSD += completion.costUSD;

  const response = {
    summary,
    context,
    faq,
    costUSD,
  };

  return response;
}

/**
 * Count tokens of text
 *
 * @param {String} text
 * @return {Number}
 */
function countTokens(text) {
  return openai.textToTokens(text).length;
}

/**
 * Worker function for indexing documents
 *
 * @param {*} payload
 */
async function indexDocument(payload) {
  const document = await db.Document.findByPk(payload.document_id);
  if (!document) return;

  try {
    await document.update({
      status: 'indexing',
    });

    let indexCostUSD = 0;
    let context = '';
    const text = document.content;

    if (!text) {
      throw new Error('Text is empty');
    }

    // ----------------------------------- REMOVE CHUNKS -------------------------------------------

    // Remove previous chunks
    logger.info(`index:${payload.document_id}`, 'Remove previous chunks');
    await db.Chunk.destroy({
      where: {
        OrganizationId: document.OrganizationId,
        DatasourceId: document.DatasourceId,
        DocumentId: document.id,
        type: 'chunk',
      },
    });

    // Break large documents in document partials
    const documentTokens = openai.textToTokens(text);
    const documentPartials = [];

    for (let i = 0; i < documentTokens.length; i += DOCUMENT_TOKEN_SIZE) {
      documentPartials.push(openai.tokensToText(documentTokens.slice(i, i + DOCUMENT_TOKEN_SIZE)));
    }

    // Process each partial
    await Promise.all(_.map(documentPartials, async (documentText, documentIndex) => {
      logger.info(`index:${payload.document_id}`, `Processing Document ${documentIndex + 1} / ${documentPartials.length}`);

      // ----------------------------------- SUMMARY -----------------------------------------------

      logger.info(`index:${payload.document_id}`, 'Generate summary');
      let summary = '';
      let faq = [];
      const questionFragments = [];
      const faqFragments = [];
      let faqChunks = [];
      let questionChunks = [];

      // Generate summary
      const response = await summarize({
        text: documentText,
      });
      summary = response.summary;
      context = response.context;
      faq = response.faq;
      indexCostUSD += response.costUSD;

      // Process summary data
      summary = `
# Document Summary: ${document.name}

${summary}
      `;

      _.each(faq, (entry) => {
        faqFragments.push(`
# ${entry.question}

${entry.answer}
        `);

        questionFragments.push(entry.question);
      });

      logger.debug('indexDocument:summary', summary);
      logger.debug('indexDocument:context', context);

      await Promise.all([
        // Chunkify document
        (async () => {
          logger.info(`index:${payload.document_id}`, 'Chunkify text');
          const chunks = chunkifyMarkdown(documentText);

          // Create chunk embeddings by injecting context
          logger.info(`index:${payload.document_id}`, 'Create chunk embeddings');
          const chunkEmbeddings = await createEmbeddings({
            texts: _.map(chunks, (chunk) => `${context}\n\n---\n\n${chunk}`),
            type: 'document',
          });
          indexCostUSD += chunkEmbeddings.costUSD;

          // Add new chunks
          logger.info(`index:${payload.document_id}`, `Add ${chunks.length} chunks to database`);
          await db.Chunk.bulkCreate(_.map(chunks, (chunk, index) => {
            logger.debug('indexDocument:chunk', chunk);
            return {
              OrganizationId: document.OrganizationId,
              DatasourceId: document.DatasourceId,
              DocumentId: document.id,
              type: 'chunk',
              content: chunk,
              contentSize: chunk.length,
              contentTokens: countTokens(chunk),
              embedding: chunkEmbeddings.embeddings[index],
            };
          }));
        })(),

        // Create summary embeddings
        (async () => {
          logger.info(`index:${payload.document_id}`, 'Create summary embedding');
          const summaryEmbeddings = await createEmbeddings({
            texts: [summary],
            type: 'document',
          });
          indexCostUSD += summaryEmbeddings.costUSD;
          await db.Chunk.create({
            OrganizationId: document.OrganizationId,
            DatasourceId: document.DatasourceId,
            DocumentId: document.id,
            type: 'summary',
            content: summary,
            contentSize: summary.length,
            contentTokens: countTokens(summary),
            embedding: summaryEmbeddings.embeddings[0],
          });
        })(),

        // FAQ
        (async () => {
          if (_.isEmpty(faq)) return;
          logger.info(`index:${payload.document_id}`, 'Create FAQ embeddings');
          const faqEmbeddings = await createEmbeddings({
            texts: _.map(faqFragments, (chunk) => `${context}\n\n---\n\n${chunk}`),
            type: 'document',
          });
          indexCostUSD += faqEmbeddings.costUSD;

          logger.info(`index:${payload.document_id}`, `Add ${faqFragments.length} FAQ to database`);
          faqChunks = await db.Chunk.bulkCreate(
            _.map(faqFragments, (chunk, index) => {
              logger.debug('indexDocument:faq', chunk);
              return {
                OrganizationId: document.OrganizationId,
                DatasourceId: document.DatasourceId,
                DocumentId: document.id,
                type: 'faq',
                content: chunk,
                contentSize: chunk.length,
                contentTokens: countTokens(chunk),
                embedding: faqEmbeddings.embeddings[index],
              };
            }),
          );
        })(),

        // Questions
        (async () => {
          if (_.isEmpty(faq)) return;
          logger.info(`index:${payload.document_id}`, 'Create Question embeddings');
          const questionEmbeddings = await createEmbeddings({
            texts: _.map(questionFragments, (chunk) => `${context}\n\n---\n\n${chunk}`),
            type: 'document',
          });
          indexCostUSD += questionEmbeddings.costUSD;

          logger.info(`index:${payload.document_id}`, `Add ${questionFragments.length} questions to database`);
          questionChunks = await db.Chunk.bulkCreate(
            _.map(questionFragments, (chunk, index) => {
              logger.debug('indexDocument:question', chunk);
              return {
                OrganizationId: document.OrganizationId,
                DatasourceId: document.DatasourceId,
                DocumentId: document.id,
                type: 'question',
                content: chunk,
                contentSize: chunk.length,
                contentTokens: countTokens(chunk),
                embedding: questionEmbeddings.embeddings[index],
              };
            }),
          );
        })(),
      ]);

      if (!_.isEmpty(faq)) {
        logger.info(`index:${payload.document_id}`, 'Associate questions with FAQ');
        await db.Relation.bulkCreate(
          _.map(questionChunks, (qChunk, index) => ({
            OrganizationId: document.OrganizationId,
            DatasourceId: document.DatasourceId,
            ChunkId: qChunk.id,
            TargetChunkId: faqChunks[index].id,
          })),
        );
      }
    }));

    // Done
    logger.info(`index:${payload.document_id}`, `Indexing complete at $${indexCostUSD}`);
    await document.update({
      status: 'indexed',
      indexCostUSD,
    });

    if (config.get('costlog:enabled')) {
      await db.CostLog.create({
        OrganizationId: document.OrganizationId,
        transactionAction: 'index',
        costUSD: indexCostUSD,
      });
    }
  } catch (err) {
    logger.error('indexDocument', err);
    await document.update({
      status: 'failed',
    });
  }
}

module.exports = indexDocument;
