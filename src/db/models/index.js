/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/config');

const db = {};
const basename = path.basename(__filename);
const sequelize = new Sequelize(process.env[config.use_env_variable], config);

fs
  .readdirSync(__dirname)
  .filter((file) => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
