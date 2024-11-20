const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Document extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Document.belongsTo(models.Organization);
      Document.belongsTo(models.Datasource);
      Document.hasMany(models.Chunk);
    }
  }
  Document.init({
    OrganizationId: DataTypes.BIGINT,
    DatasourceId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    name: DataTypes.STRING,
    content: DataTypes.TEXT,
    contentSource: DataTypes.TEXT,
    contentType: DataTypes.STRING,
    contentHash: DataTypes.STRING,
    contentSize: DataTypes.INTEGER,
    indexCostUSD: DataTypes.FLOAT,
    metadata: DataTypes.JSONB,
    status: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Document;
};
