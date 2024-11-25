/* eslint-disable no-loop-func */
const _ = require('lodash');
const db = require('../../db/models');
const logger = require('../../logger');
const config = require('../../config');
const cohere = require('../../llms/cohere');
const openai = require('../../llms/openai');
const { countWords } = require('../../helpers/utils');
const { chunkifyMarkdown } = require('../../helpers/chunker');
const { LLM_CREATIVITY_NONE, LLM_QUALITY_MEDIUM } = require('../../constants');

const PARALLEL_SIZE = 10;

/**
 * Summarize
 *
 * @param {*} { text, maxWords }
 * @return {String}
 */
async function summarize({ text, maxWords }) {
  const prompt = `
  ## Instructions

1. You are provided with a document that needs to be summarized.
2. Your task is to create a concise summary of the document, capturing its key points and main ideas in up to ${maxWords} words.
3. This summary will be used for embeddings and similarity search purposes.
4. Ensure that the summary is clear, accurate, and retains the essence of the original document.
5. After the summary is generated, also create a sort couple of sentences text that summarizes the summary, called context.

Response in JSON format.

Example response:
{
  "summary": "This is summary of the document",
  "context": "This is a short summary of the summary"
}

## Document:
${text}
  `;

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

  const response = {
    summary: completion.output.summary,
    context: completion.output.context,
    costUSD: completion.costUSD,
  };

  return response;
}

/**
 * Question bank
 *
 * @param {*} { text }
 * @return {String}
 */
async function questionBank({ text }) {
  const prompt = `
You are an AI designed to create a knowledge base by generating questions based on the provided document.
Given the document below, return questions that can be directly answered using the information from the document.
Ensure the questions are clear, concise, and relevant to the key details in the document, and return them in a JSON array format.

# Instructions:
1. Read the provided document carefully.
2. Identify key details, facts, and concepts.
3. Formulate questions based on these key details. Each question should be answerable using the available information from the document only.
4. Ensure the questions cover a range of information from the text, including but not limited to definitions, explanations, dates, names, events, processes, and relationships.
5. Do not refer to the "document" or "text" in the generated questions. Do not use these words.
6. Return questions in a JSON array format.

Example JSON reponse:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ]
}

Now, generate questions from the provided document:

${text}
  `;

  let completion;

  try {
    completion = await openai.inference({
      text: prompt,
      creativity: LLM_CREATIVITY_NONE,
      quality: LLM_QUALITY_MEDIUM,
      json: true,
    });
  } catch (err) {
    logger.error('questionBank:openai', err);

    try {
      completion = await cohere.inference({
        text: prompt,
        creativity: LLM_CREATIVITY_NONE,
        quality: LLM_QUALITY_MEDIUM,
        json: true,
      });
    } catch (err2) {
      logger.error('questionBank:cohere', err2);
    }
  }

  const response = {
    questions: completion.output.questions,
    costUSD: completion.costUSD,
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
    let indexCostUSD = 0;
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

    // ----------------------------------- SUMMARY -------------------------------------------------

    // Create summary
    logger.info(`index:${payload.document_id}`, 'Generate summary');
    let summary = '';
    let context = '';
    if (countWords(text) >= 200) {
      const response = await summarize({
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
        const response = await questionBank({ text: chunkModel.content });
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
