module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Conversations', 'title', {
      type: Sequelize.STRING,
      defaultValue: '',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Conversations', 'title');
  },
};
