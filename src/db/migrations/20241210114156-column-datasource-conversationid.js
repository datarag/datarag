module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Datasources', 'ConversationId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'Conversations',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Datasources', 'ConversationId');
  },
};
