const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RagLog extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      RagLog.belongsTo(models.Organization);
      RagLog.belongsTo(models.ApiKey);
    }
  }
  RagLog.init({
    OrganizationId: DataTypes.BIGINT,
    ApiKeyId: DataTypes.BIGINT,
    transactionId: DataTypes.STRING,
    compressedLog: DataTypes.BLOB,
    compressedSize: DataTypes.INTEGER,
    uncompressedSize: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return RagLog;
};
