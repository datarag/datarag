const _ = require('lodash');
const db = require('../src/db/models');
const { hashToken } = require('../src/helpers/tokens');
const logger = require('./log');

const myArgs = process.argv.slice(2);
let orgName;
let token;
let apiName;

_.each(myArgs, (arg) => {
  if (arg.indexOf('org=') === 0) {
    orgName = arg.replace('org=', '');
  }
  if (arg.indexOf('apikey=') === 0) {
    token = arg.replace('apikey=', '');
  }
  if (arg.indexOf('name=') === 0) {
    apiName = arg.replace('name=', '');
  }
});

if (!orgName || !token || !apiName || myArgs.indexOf('-h') >= 0) {
  logger.print('Usage: node cli/create_apikey org=<name> apikey=<key> name=<apikey-name>');
  process.exit();
}

async function proc() {
  const organization = await db.Organization.findOne({
    where: {
      resId: orgName,
    },
  });
  if (!organization) {
    logger.error('Could not find organization');
    process.exit();
  }

  const apiKey = await db.ApiKey.create({
    OrganizationId: organization.id,
    tokenHash: hashToken(token),
    name: apiName,
  });

  logger.print(JSON.stringify(organization.toJSON(), null, 2));
  logger.print(JSON.stringify(apiKey.toJSON(), null, 2));
  process.exit();
}

proc();
