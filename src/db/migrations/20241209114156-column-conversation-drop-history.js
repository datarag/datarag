module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('Conversations', 'history');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Conversations', 'history', {
      type: Sequelize.JSONB,
      allowNull: false,
    });
  },
};
