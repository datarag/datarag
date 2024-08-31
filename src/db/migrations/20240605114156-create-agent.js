module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Agents', {
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
      resId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      purpose: {
        type: Sequelize.TEXT,
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
    return queryInterface.addConstraint('Agents', {
      fields: ['OrganizationId', 'resId'],
      type: 'unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Agents');
  },
};
