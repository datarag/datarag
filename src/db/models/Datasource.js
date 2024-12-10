const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Datasource extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Datasource.belongsTo(models.Organization);
      Datasource.belongsTo(models.Conversation);
      Datasource.belongsToMany(models.Agent, {
        through: models.AgentDatasource,
      });
      Datasource.hasMany(models.Document);
      Datasource.hasMany(models.Connector);
      Datasource.hasMany(models.Chunk);
      Datasource.hasMany(models.Relation);
    }
  }
  Datasource.init({
    OrganizationId: DataTypes.BIGINT,
    ConversationId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    name: DataTypes.STRING,
    purpose: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Datasource;
};
