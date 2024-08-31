const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CostLog extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      CostLog.belongsTo(models.Organization);
      CostLog.belongsTo(models.ApiKey);
    }
  }
  CostLog.init({
    OrganizationId: DataTypes.BIGINT,
    ApiKeyId: DataTypes.BIGINT,
    transactionId: DataTypes.STRING,
    transactionAction: DataTypes.STRING,
    costUSD: DataTypes.FLOAT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return CostLog;
};
