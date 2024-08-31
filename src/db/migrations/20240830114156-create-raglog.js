module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RagLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      OrganizationId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Organizations',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      ApiKeyId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'ApiKeys',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      transactionId: {
        type: Sequelize.STRING,
      },
      compressedLog: {
        type: Sequelize.BLOB,
      },
      compressedSize: {
        type: Sequelize.INTEGER,
      },
      uncompressedSize: {
        type: Sequelize.INTEGER,
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
    await queryInterface.addIndex('RagLogs', ['OrganizationId', 'transactionId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('RagLogs');
  },
};
