const _ = require('lodash');
const db = require('../src/db/models');
const logger = require('./log');

const myArgs = process.argv.slice(2);
let name;

_.each(myArgs, (arg) => {
  if (arg.indexOf('name=') === 0) {
    name = arg.replace('name=', '');
  }
});

if (!name || myArgs.indexOf('-h') >= 0) {
  logger.print('Usage: node cli/create_organization name=<name>');
  process.exit();
}

async function proc() {
  const organization = await db.Organization.create({
    resId: name,
  });
  logger.print(JSON.stringify(organization.toJSON(), null, 2));
  process.exit();
}

proc();
