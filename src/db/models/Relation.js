const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Relation extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Relation.belongsTo(models.Organization);
      Relation.belongsTo(models.Datasource);
      Relation.belongsTo(models.Chunk);
      Relation.belongsTo(models.Chunk, { as: 'TargetChunk', foreignKey: 'TargetChunkId' });
    }
  }
  Relation.init({
    OrganizationId: DataTypes.BIGINT,
    DatasourceId: DataTypes.BIGINT,
    ChunkId: DataTypes.BIGINT,
    TargetChunkId: DataTypes.BIGINT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Relation;
};
