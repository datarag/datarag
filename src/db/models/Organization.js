const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
      Organization.hasMany(models.ApiKey);
      Organization.hasMany(models.Datasource);
      Organization.hasMany(models.Agent);
      Organization.hasMany(models.Document);
      Organization.hasMany(models.Connector);
      Organization.hasMany(models.Chunk);
      Organization.hasMany(models.Relation);
      Organization.hasMany(models.Conversation);
      Organization.hasMany(models.AuditLog);
      Organization.hasMany(models.RagLog);
      Organization.hasMany(models.CostLog);
    }
  }
  Organization.init({
    resId: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Organization;
};
