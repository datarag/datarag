const _ = require('lodash');
const pgvector = require('pgvector/utils');
const db = require('../db/models');

/**
 * Perform full text search on database
 *
 * @param {*} {
 *   query, queryVector, organizationId, datasourceIds, limit, offset,
 * }
 * @return {*}
 */
async function fullTextSearch({
  query, queryVector, organizationId, datasourceIds, limit, offset,
}) {
  if (!organizationId) throw new Error('Missing organizationId');
  if (_.isEmpty(datasourceIds)) throw new Error('Missing datasourceIds');
  if (!query || !queryVector) throw new Error('Missing query/vector');

  // Do full text search
  const chunks = await db.sequelize.query(`
    SELECT *,
      (1 - ("embedding" <=> :vector)) as similarity,
      ts_rank("_search", websearch_to_tsquery('english', :query)) as rank
    FROM "${db.Chunk.tableName}"
    WHERE
      "OrganizationId" = :orgid AND
      "DatasourceId" IN (:dsids) AND
      "type" = 'chunk' AND
      "_search" @@ websearch_to_tsquery('english', :query)
    ORDER BY rank DESC, similarity DESC
    LIMIT ${limit || 100} OFFSET ${offset || 0};
  `, {
    model: db.Chunk,
    replacements: {
      query,
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
  fullTextSearch,
};
