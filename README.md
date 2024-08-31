![logo](logo.jpg)

# Datarag.ai

Have real-time discussions with your data.

[Website](https://datarag.ai) | [API documentation](https://api.datarag.ai/docs)

## Why another Retrieval-Augmented-Generation solution?

Creating a working RAG solution that actually works without hallucinations is super hard.

Most AI tools and frameworks are tied to Python programming language.

We make it easy by offering an opinionated RAG as a Service through an API. This way, you can build your AI apps using any programming language.

## How Datarag works

### 1. Add your content

Upload your documents or website, connect your DB to fetch data, or integrate to your knowledge base.

### 2. Index and Organize your content

Datarag generates your extended knowledge base.

You can organize content into collections based on usage. (e.g. Help Assistance, Tutoring, Pre-sales internal Assistance)

### 3. Question your data

Ask questions and retrieve your most relevant content, using Datarag indexing.

Get additional information to enrich your content.

### 4. Format your final answer using an LLM, or not

Connect an LLM of choice, pick one supported natively, or manage your results manually to format a response.

### 5. Keep your Knowledge base up to date

Close the loop by updating your content as you build new things.

Set automation or jobs to update your knowledge base.

## Behind the scenes

You can use the Datarag API to upload and organize your content into agents.

Each agent contains a set of datasources.

Each datasource may contain documents or connectors to third party data.

When you upload your content, Datarag will automatically:
- Clean the data
- Split the data into chunks
- Create a question bank
- Create summaries
- Generate full-text-search and semantic indexing on your data

Then, you can use the retrieval or Chat API endpoints to retrieve data based on user questions. Datarag will find the optimal way using a combination of hybrid search and reranking, to get the most relevant information based on your budget (tokens, characters, documents).

## Local / Development setup

Make sure that you have Docker installed.

Copy `docker-compose.example.env` to `docker-compose.env` and set the appropriate environment variables, such as your Cohere and OpenAI keys.

Then, build and run the service:

```
make build_dev
make migrate
make up
```

The service is available at: http://localhost:4100

To run the tests:

```
make test
```

To access the shell:

```
make shell
```

To access the raw database (pg client):
```
make dbshell
```

See `Makefile` for more options.

## Production deployment

You will need:
- A Postgres database with pgvector extention available
- Redis server

Check `src/config.js` for environment variables you can override.

At minimum set the following:

- `DATARAG_API_TOKEN_SALT`
- `DATARAG_COHERE_API_KEY`
- `DATARAG_OPENAI_API_KEY`
- `DATARAG_HOST`
- `DATARAG_SENTRY_DSN` (optional)
- `NEWRELIC_KEY` (optional)
- `POSTGRES_CONNECT_URL`
- `REDIS_CONNECT_URL`

Then make sure that the following commands are executed upon deployment:

- Build Command: `npm ci`
- Pre-Deploy Command: `npm run migrate`
- Start Command: `npm start`
- Health Check Path: `/_/health`

To build a Docker production image do:
```
make build_prod
```

# License

Licensed under Apache License 2.0, see [LICENSE](LICENSE) file.
