/* eslint-disable no-underscore-dangle */
const Sequelize = require('sequelize');
const pgvector = require('pgvector/sequelize');

pgvector.registerType(Sequelize);

const data = {
  use_env_variable: process.env.NODE_ENV === 'test' ? 'POSTGRES_TEST_CONNECT_URL' : 'POSTGRES_CONNECT_URL',
  dialect: 'postgres',
  logging: false,
};

module.exports = data;
