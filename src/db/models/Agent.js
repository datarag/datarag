const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Agent extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Agent.belongsTo(models.Organization);
      Agent.belongsToMany(models.Datasource, {
        through: models.AgentDatasource,
      });
    }
  }
  Agent.init({
    OrganizationId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    name: DataTypes.STRING,
    purpose: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Agent;
};
