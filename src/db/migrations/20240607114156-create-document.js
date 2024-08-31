module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Documents', {
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
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      contentType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contentHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contentSize: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      indexCostUSD: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      status: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addConstraint('Documents', {
      fields: ['OrganizationId', 'DatasourceId', 'resId'],
      type: 'unique',
    });
    await queryInterface.addIndex('Documents', ['OrganizationId', 'DatasourceId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Documents');
  },
};
