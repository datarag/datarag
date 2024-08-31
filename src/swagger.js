const swaggerJsDoc = require('swagger-jsdoc');

const swaggerSpecs = swaggerJsDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Datarag.ai',
      version: 'v1',
      description: `
Welcome to the official API Datarag documention.

The API is a collection of endpoints for training knowledge bases, connecting external APIs as datasources, and
setting up agents for chat and retrieval augmented generation.

# Authentication

To use the API, you must authenticate your requests with token authentication.

To do this:

- Obtain an API authentication token
- Use the \`Bearer\` keyword and append the token when setting the \`Authorization\` header.

For example, the HTTP request header should look like this:
\`\`\`
Authorization: Bearer YOUR-DATARAG-API-TOKEN
\`\`\`

# Pagination

Endpoints that support pagination (e.g. listing resources) as limited by default to 100
results per page.

You can control pagination limits by setting the \`limit=X\` query param.

Responses with paginated results will return a \`next_cursor\` that can
be passed as query parameter on subsequent calls to retrieve next pages.

Example:
\`\`\`
// 1st page
GET /v1/datasources?limit=50
{
  "data": [{ ... }],
  "next_cursor": "3523"
}

// 2nd (and final) page
GET /v1/datasources?limit=50&cursor=3523
{
  "data": [{ ... }]
}
\`\`\`

`,
    },
    servers: [
      {
        url: 'https://api.datarag.ai',
        description: '',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    /*
    security: [
      {
        bearerAuth: [],
      },
    ],
    */
    tags: [{
      name: 'Datasources',
      description: `
A Datasource defines a corpus of knowledge over a specific domain.

For example a help center, a marketing blog, connections to external databases or tools etc.

It is recommended that you create a datasource for each specific domain of your use case. This way you
can better segment content, update it, and use it for the retrieval process either by querying the data
or chatting through agents.

A datasource is trained in two ways:
- By uploading documents that is automatically indexed by Datarag.
- By setting connectors, so that data can be dynamically retrieved from third-party apps.
      `,
    }, {
      name: 'Datasources ➝ Documents',
      description: `
A Document is a fragment of knowledge inside a datasource, like a webpage, text, or a PDF document.

Upon indexing, a document is split into chunks, summarized and a question bank is generated to assist
with better precision during RAG process.
      `,
    }, {
      name: 'Datasources ➝ Connectors',
      description: `
A Connector is an API spec that is used to retrieve data from a third-party app or database.
      `,
    }, {
      name: 'Agents',
      description: 'API οperations for agent management.',
    }, {
      name: 'Agents ➝ Datasources',
      description: 'API οperations for grouping datasources together to form an agent.',
    }, {
      name: 'Retrieval',
      description: 'API οperations query a knowledge base.',
    }, {
      name: 'Generative AI',
      description: 'API οperations for Retrieval Augmented Generation.',
    }],
  },
  apis: ['./src/v1/**/*.js'],
});

module.exports = swaggerSpecs;
