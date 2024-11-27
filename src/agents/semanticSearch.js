const _ = require('lodash');
const pgvector = require('pgvector/utils');
const db = require('../db/models');
const config = require('../config');

const CUTOFF = config.get('retrieval:embeddings:cutoff');

/**
 * Perform semantic search on database
 *
 * @param {*} {
 *   query, queryVector, organizationId, datasourceIds, limit, offset, type
 * }
 * @return {*}
 */
async function semanticSearch({
  query, queryVector, organizationId, datasourceIds, limit, offset, type,
}) {
  if (!organizationId) throw new Error('Missing organizationId');
  if (_.isEmpty(datasourceIds)) throw new Error('Missing datasourceIds');
  if (!query || !queryVector) throw new Error('Missing query/vector');

  const filter = type
    ? `"type" = '${type}' AND `
    : '';

  const chunks = await db.sequelize.query(`
    SELECT *,
      (1 - ("embedding" <=> :vector)) as similarity
    FROM "${db.Chunk.tableName}"
    WHERE
      ${filter}
      "OrganizationId" = :orgid AND
      "DatasourceId" IN (:dsids) AND
      (1 - ("embedding" <=> :vector)) >= ${CUTOFF}
    ORDER BY similarity DESC
    LIMIT ${limit || 1000} OFFSET ${offset || 0};
  `, {
    model: db.Chunk,
    replacements: {
      orgid: organizationId,
      dsids: datasourceIds,
      vector: pgvector.toSql(queryVector),
    },
  });

  return {
    costUSD: 0,
    data: _.map(chunks, (chunk) => chunk.toJSON()),
  };
}

module.exports = {
  semanticSearch,
};
