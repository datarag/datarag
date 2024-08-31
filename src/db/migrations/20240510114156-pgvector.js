module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
  },
  async down() {
    // No-op
  },
};
