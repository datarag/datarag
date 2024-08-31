module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Relations', {
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
      ChunkId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Chunks',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      TargetChunkId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Chunks',
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
    await queryInterface.addConstraint('Relations', {
      fields: ['ChunkId', 'TargetChunkId'],
      type: 'unique',
    });
    await queryInterface.addIndex('Relations', ['OrganizationId', 'DatasourceId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Relations');
  },
};
