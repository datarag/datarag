const Sequelize = require('sequelize');
const pgvector = require('pgvector/sequelize');

pgvector.registerType(Sequelize);

module.exports = (sequelize, DataTypes) => {
  pgvector.registerType(DataTypes);

  class Embedding extends Sequelize.Model {
    // eslint-disable-next-line no-unused-vars
    static associate(models) {
    }
  }
  Embedding.init({
    model: DataTypes.STRING,
    type: DataTypes.STRING,
    contentHash: DataTypes.STRING,
    embedding: Sequelize.DataTypes.VECTOR(1024),
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
  });
  return Embedding;
};
