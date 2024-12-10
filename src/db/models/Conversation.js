const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Conversation.belongsTo(models.Organization);
      Conversation.belongsTo(models.ApiKey);
      Conversation.hasMany(models.Turn);
      Conversation.hasMany(models.Datasource);
    }
  }
  Conversation.init({
    OrganizationId: DataTypes.BIGINT,
    ApiKeyId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    title: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Conversation;
};
