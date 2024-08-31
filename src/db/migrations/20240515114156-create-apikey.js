module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ApiKeys', {
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
      tokenHash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING,
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
    await queryInterface.addIndex('ApiKeys', ['tokenHash']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ApiKeys');
  },
};
