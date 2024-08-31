module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AgentDatasources', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      AgentId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Agents',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      DatasourceId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Datasources',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
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
    return queryInterface.addConstraint('AgentDatasources', {
      fields: ['AgentId', 'DatasourceId'],
      type: 'unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('AgentDatasources');
  },
};
