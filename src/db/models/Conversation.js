const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Conversation.belongsTo(models.Organization);
    }
  }
  Conversation.init({
    OrganizationId: DataTypes.BIGINT,
    resId: DataTypes.STRING,
    history: DataTypes.JSONB,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Conversation;
};
