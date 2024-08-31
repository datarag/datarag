module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AuditLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      OrganizationId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'Organizations',
          key: 'id',
        },
        onDelete: 'SET NULL',
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
      ipAddress: {
        type: Sequelize.STRING,
      },
      transactionId: {
        type: Sequelize.STRING,
      },
      action: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
      },
      details: {
        type: Sequelize.JSONB,
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
    await queryInterface.addIndex('AuditLogs', ['OrganizationId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('AuditLogs');
  },
};
