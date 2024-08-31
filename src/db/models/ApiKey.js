const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ApiKey extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      ApiKey.belongsTo(models.Organization);
      ApiKey.hasMany(models.AuditLog);
      ApiKey.hasMany(models.RagLog);
      ApiKey.hasMany(models.CostLog);
    }
  }
  ApiKey.init({
    OrganizationId: DataTypes.BIGINT,
    tokenHash: DataTypes.STRING,
    name: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return ApiKey;
};
