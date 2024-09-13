module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ApiKeys', 'scopes', {
      type: Sequelize.STRING,
      defaultValue: '',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ApiKeys', 'scopes');
  },
};
