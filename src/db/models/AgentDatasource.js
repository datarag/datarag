const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AgentDatasource extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      AgentDatasource.belongsTo(models.Agent);
      AgentDatasource.belongsTo(models.Datasource);
    }
  }
  AgentDatasource.init({
    AgentId: DataTypes.BIGINT,
    DatasourceId: DataTypes.BIGINT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return AgentDatasource;
};
