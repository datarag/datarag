module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Turns', {
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
        allowNull: false,
        references: {
          model: 'ApiKeys',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      ConversationId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Conversations',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      resId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      tokens: {
        type: Sequelize.INTEGER,
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
    await queryInterface.addIndex('Turns', ['ConversationId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Turns');
  },
};
