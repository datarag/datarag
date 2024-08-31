module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Connectors', {
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
      resId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      endpoint: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      method: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      function: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
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
    await queryInterface.addConstraint('Connectors', {
      fields: ['OrganizationId', 'DatasourceId', 'resId'],
      type: 'unique',
    });
    await queryInterface.addIndex('Connectors', ['OrganizationId', 'DatasourceId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Connectors');
  },
};
