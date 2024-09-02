/* eslint-disable no-loop-func */
// Polyfill for pdfjs
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function pf() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const { NodeHtmlMarkdown } = require('node-html-markdown');
const _ = require('lodash');
const pdf2md = require('@opendocsg/pdf2md');
const tiktoken = require('tiktoken');
const db = require('../../db/models');
const logger = require('../../logger');
const config = require('../../config');
const cohere = require('../../llms/cohere');
const openai = require('../../llms/openai');
const { countWords } = require('../../helpers/utils');
const { chunkifyMarkdown } = require('../../helpers/chunker');

const encoding = tiktoken.get_encoding('cl100k_base');
const PARALLEL_SIZE = 10;

function countTokens(text) {
  return encoding.encode(text).length;
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
    let indexCostUSD = 0;
    let text = '';

    // ----------------------------------- CLEAN DATA ----------------------------------------------

    // Convert text to Markdown
    logger.info(`index:${payload.document_id}`, 'Clean data');
    switch (document.contentType) {
      case 'text':
      case 'markdown':
        text = document.content;
        break;
      case 'pdf':
        text = await pdf2md(Uint8Array.from(atob(document.content), (c) => c.charCodeAt(0)));
        break;
      case 'url':
      case 'html':
        text = NodeHtmlMarkdown.translate(document.content);
        break;
      default:
        throw new Error('Unknown content type');
    }

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

    // ----------------------------------- SUMMARY -------------------------------------------------

    // Create summary
    logger.info(`index:${payload.document_id}`, 'Generate summary');
    let summary = '';
    let context = '';
    if (countWords(text) >= 200) {
      const response = await openai.summarize({
        text,
        maxWords: 200,
      });
      summary = response.summary;
      context = response.context;
      indexCostUSD += response.costUSD;
    } else {
      summary = text;
    }

    // Create summary embeddings
    logger.info(`index:${payload.document_id}`, 'Create summary embedding');
    const summaryEmbeddings = await cohere.createEmbeddings({
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

    // ----------------------------------- CHUNKS -------------------------------------------------

    // Break up text into chunks
    logger.info(`index:${payload.document_id}`, 'Chunkify text');
    const chunks = chunkifyMarkdown(text);

    // Create chunk embeddings by injecting context
    logger.info(`index:${payload.document_id}`, 'Create chunk embeddings');
    const chunkEmbeddings = await cohere.createEmbeddings({
      texts: _.map(chunks, (chunk) => `${context}\n\n---\n\n${chunk}`),
      type: 'document',
    });
    indexCostUSD += chunkEmbeddings.costUSD;
    // Add new chunks
    logger.info(`index:${payload.document_id}`, 'Add chunks to database');
    const chunkModels = await db.Chunk.bulkCreate(_.map(chunks, (chunk, index) => ({
      OrganizationId: document.OrganizationId,
      DatasourceId: document.DatasourceId,
      DocumentId: document.id,
      type: 'chunk',
      content: chunk,
      contentSize: chunk.length,
      contentTokens: countTokens(chunk),
      embedding: chunkEmbeddings.embeddings[index],
    })));

    // ---------------------------------- QUESTION BANK -------------------------------------------

    logger.info(`index:${payload.document_id}`, 'Create question bank');
    const chunkGroups = _.chunk(chunkModels, PARALLEL_SIZE);
    for (let i = 0; i < chunkGroups.length; i += 1) {
      await Promise.all(_.map(chunkGroups[i], async (chunkModel) => {
        const response = await openai.questionBank({ text: chunkModel.content });
        indexCostUSD += response.costUSD;
        if (_.isEmpty(response.questions)) {
          return;
        }

        logger.info(`index:${payload.document_id}`, `${response.questions.length} questions generated`);

        const qEmbeddings = await cohere.createEmbeddings({
          texts: response.questions,
          type: 'query',
        });
        indexCostUSD += qEmbeddings.costUSD;
        const qChunks = await db.Chunk.bulkCreate(_.map(response.questions, (question, index) => ({
          OrganizationId: document.OrganizationId,
          DatasourceId: document.DatasourceId,
          DocumentId: document.id,
          type: 'question',
          content: question,
          contentSize: question.length,
          contentTokens: countTokens(question),
          embedding: qEmbeddings.embeddings[index],
        })));

        await db.Relation.bulkCreate(_.map(qChunks, (qChunk) => ({
          OrganizationId: document.OrganizationId,
          DatasourceId: document.DatasourceId,
          ChunkId: qChunk.id,
          TargetChunkId: chunkModel.id,
        })));
      }));
    }

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
