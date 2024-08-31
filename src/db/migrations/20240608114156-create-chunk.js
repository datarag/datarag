module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Chunks', {
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
      DatasourceId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Datasources',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      DocumentId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Documents',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      contentSize: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      contentTokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      embedding: {
        type: Sequelize.DataTypes.VECTOR(1024),
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
    await queryInterface.addIndex('Chunks', ['OrganizationId', 'DatasourceId']);
    await queryInterface.sequelize.query('CREATE INDEX ON "Chunks" USING hnsw (embedding vector_cosine_ops);');
    // Add full text search
    await queryInterface.sequelize.query(`
      ALTER TABLE "Chunks" ADD COLUMN _search TSVECTOR;
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Chunks" SET _search = to_tsvector('english', content);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX "Chunks_search" ON "Chunks" USING gin(_search);
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Chunks_vector_update"
      BEFORE INSERT OR UPDATE ON "Chunks"
      FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(_search, 'pg_catalog.english', content);
    `);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Chunks');
  },
};
