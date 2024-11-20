const db = require('../src/db/models');
const { hashToken } = require('../src/helpers/tokens');
const { countJobs } = require('../src/queue');
const { initializeQueue } = require('../src/queue/init');
const { SCOPE_ALL } = require('../src/scopes');

async function waitWorker() {
  let isProcessing = false;
  do {
    const counts = await countJobs();
    isProcessing = (counts.active + counts.waiting + counts.delayed) > 0;
  } while (isProcessing);
}

async function tearDownOrg(name) {
  const organization = await db.Organization.findOne({
    where: {
      resId: name,
    },
  });
  if (organization) {
    await organization.destroy();
  }
}

async function setupOrg(name) {
  await initializeQueue();
  await waitWorker();
  await tearDownOrg(name);

  const organization = await db.Organization.create({
    resId: name,
  });

  const apiKey = await db.ApiKey.create({
    OrganizationId: organization.id,
    tokenHash: hashToken(name),
    name,
    scopes: SCOPE_ALL,
  });

  const datasource = await db.Datasource.create({
    OrganizationId: organization.id,
    resId: name,
    name,
    purpose: name,
  });

  const agent = await db.Agent.create({
    OrganizationId: organization.id,
    resId: name,
    name,
    purpose: name,
  });

  const agentDatasource = await db.AgentDatasource.create({
    AgentId: agent.id,
    DatasourceId: datasource.id,
  });

  const document = await db.Document.create({
    OrganizationId: organization.id,
    DatasourceId: datasource.id,
    resId: name,
    name,
    content: name,
    contentSource: name,
    contentType: 'text',
    contentHash: 'abcd',
    contentSize: 4,
    metadata: { foo: 'bar' },
    status: 'indexed',
  });

  const connector = await db.Connector.create({
    OrganizationId: organization.id,
    DatasourceId: datasource.id,
    resId: name,
    name,
    purpose: 'purpose',
    endpoint: 'https://www.example.com',
    method: 'get',
    function: name,
    payload: {},
    metadata: { foo: 'bar' },
  });

  return {
    organization,
    apiKey,
    datasource,
    agent,
    agentDatasource,
    document,
    connector,
  };
}

module.exports = {
  setupOrg,
  tearDownOrg,
  waitWorker,
};
