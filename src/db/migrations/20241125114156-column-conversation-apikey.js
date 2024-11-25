module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Conversations', 'ApiKeyId', {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: {
        model: 'ApiKeys',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Conversations', 'ApiKeyId');
  },
};
