const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Turn extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Turn.belongsTo(models.Organization);
      Turn.belongsTo(models.ApiKey);
      Turn.belongsTo(models.Conversation);
    }
  }
  Turn.init({
    resId: DataTypes.STRING,
    OrganizationId: DataTypes.BIGINT,
    ApiKeyId: DataTypes.BIGINT,
    ConversationId: DataTypes.BIGINT,
    payload: DataTypes.JSONB,
    metadata: DataTypes.JSONB,
    tokens: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Turn;
};
