const Sequelize = require('sequelize');
const pgvector = require('pgvector/sequelize');

pgvector.registerType(Sequelize);

module.exports = (sequelize, DataTypes) => {
  pgvector.registerType(DataTypes);

  class Chunk extends Sequelize.Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Chunk.belongsTo(models.Organization);
      Chunk.belongsTo(models.Datasource);
      Chunk.belongsTo(models.Document);
      Chunk.hasMany(models.Relation);
      Chunk.hasMany(models.Relation, { as: 'SourceChunks', foreignKey: 'TargetChunkId' });
    }
  }
  Chunk.init({
    OrganizationId: DataTypes.BIGINT,
    DatasourceId: DataTypes.BIGINT,
    DocumentId: DataTypes.BIGINT,
    type: DataTypes.STRING,
    content: DataTypes.TEXT,
    contentSize: DataTypes.INTEGER,
    contentTokens: DataTypes.INTEGER,
    embedding: Sequelize.DataTypes.VECTOR(1024),
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Chunk;
};
