module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Embeddings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contentHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      embedding: {
        type: Sequelize.DataTypes.VECTOR(1024),
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('Embeddings', ['type', 'model', 'contentHash']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Embeddings');
  },
};
