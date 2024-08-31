const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      AuditLog.belongsTo(models.Organization);
      AuditLog.belongsTo(models.ApiKey);
    }
  }
  AuditLog.init({
    OrganizationId: DataTypes.BIGINT,
    ApiKeyId: DataTypes.BIGINT,
    ipAddress: DataTypes.STRING,
    transactionId: DataTypes.STRING,
    action: DataTypes.STRING,
    status: DataTypes.STRING,
    details: DataTypes.JSONB,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return AuditLog;
};
