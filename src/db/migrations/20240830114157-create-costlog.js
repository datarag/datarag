module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CostLogs', {
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
      transactionAction: {
        type: Sequelize.STRING,
      },
      costUSD: {
        type: Sequelize.FLOAT,
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
    await queryInterface.addIndex('CostLogs', ['OrganizationId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('CostLogs');
  },
};
