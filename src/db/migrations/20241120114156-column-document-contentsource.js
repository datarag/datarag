module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Documents', 'contentSource', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Documents', 'contentSource');
  },
};
