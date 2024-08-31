const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Connector extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Connector.belongsTo(models.Organization);
      Connector.belongsTo(models.Datasource);
    }
  }
  Connector.init({
    OrganizationId: DataTypes.BIGINT,
    DatasourceId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    name: DataTypes.STRING,
    purpose: DataTypes.TEXT,
    endpoint: DataTypes.STRING,
    method: DataTypes.STRING,
    payload: DataTypes.JSONB,
    metadata: DataTypes.JSONB,
    function: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Connector;
};
