FROM node:20.16.0-alpine as datarag-builder

ARG USER_ID
ARG GROUP_ID

RUN deluser node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -D node -G node

USER node
WORKDIR /usr/app

COPY --chown=node:node \
    package.json \
    package-lock.json \
    .sequelizerc \
    .eslintrc \
    newrelic.js \
    /usr/app/

EXPOSE 4100

# ----------- Production image -----------

FROM datarag-builder as datarag

ENV NODE_ENV=production

RUN npm ci

COPY --chown=node:node ./templates /usr/app/templates
COPY --chown=node:node ./tests /usr/app/tests
COPY --chown=node:node ./src /usr/app/src
COPY --chown=node:node ./cli /usr/app/cli

CMD ["npm", "start"]

# ----------- Development image -----------

FROM datarag-builder as datarag-devel

# Install PostgreSQL client tools
USER root
RUN apk update && \
    apk add --no-cache postgresql-client
USER node

ENV NODE_ENV=development

RUN npm ci

COPY --chown=node:node ./templates /usr/app/templates
COPY --chown=node:node ./tests /usr/app/tests
COPY --chown=node:node ./src /usr/app/src
COPY --chown=node:node ./cli /usr/app/cli

CMD ["npm", "run", "dev"]
