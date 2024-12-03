const _ = require('lodash');
const md5 = require('../helpers/md5');
const db = require('../db/models');
const cohere = require('../llms/cohere');

const { Op } = db.Sequelize;
/**
 * Create embeddings
 *
 * @param {*} {
 *   texts, type
 * }
 * @return {*}
 */
async function createEmbeddings({ texts, type }) {
  if (_.isEmpty(texts)) {
    return {
      embeddings: [],
      costUSD: 0,
    };
  }

  const model = cohere.getEmbeddingsModel();
  const mapTextToHash = {};
  const hashList = [];
  _.each(texts, (text) => {
    const hash = md5(text);
    mapTextToHash[text] = hash;
    hashList.push(hash);
  });

  const existingEmbeddings = await db.Embedding.findAll({
    where: {
      model,
      type,
      contentHash: {
        [Op.in]: hashList,
      },
    },
  });

  const existingEmbeddingsHashToEmbedding = {};
  _.each(existingEmbeddings, (entry) => {
    existingEmbeddingsHashToEmbedding[entry.contentHash] = entry.embedding;
  });

  const textToProcess = [];
  _.each(texts, (text) => {
    const hash = mapTextToHash[text];
    if (!existingEmbeddingsHashToEmbedding[hash]) {
      textToProcess.push(text);
    }
  });

  const response = await cohere.createEmbeddings({
    texts: textToProcess,
    type,
  });
  const newEmbeddingsHashToEmbedding = {};
  const newModels = [];
  _.each(textToProcess, (text, index) => {
    const hash = mapTextToHash[text];
    newEmbeddingsHashToEmbedding[hash] = response.embeddings[index];
    newModels.push({
      model,
      type,
      contentHash: hash,
      embedding: response.embeddings[index],
    });
  });

  if (!_.isEmpty(newModels)) {
    await db.Embedding.bulkCreate(newModels);
  }

  return {
    embeddings: _.map(texts, (text) => {
      const hash = mapTextToHash[text];
      return (
        newEmbeddingsHashToEmbedding[hash]
        || existingEmbeddingsHashToEmbedding[hash]
      );
    }),
    costUSD: response.costUSD,
  };
}

module.exports = {
  createEmbeddings,
};
