const express = require('express');
const nunjucks = require('nunjucks');
const { nanoid } = require('nanoid');
const cors = require('cors');
const bodyParser = require('body-parser');
const compress = require('compression');
const OpenApiValidator = require('express-openapi-validator');
const { Server } = require('http');
const v1Router = require('./v1');
const swaggerSpec = require('./swagger');
const logger = require('./logger');
const config = require('./config');
const sentry = require('./sentry');
const { initializeQueue } = require('./queue/init');
const { logTransaction } = require('./transactionlog');

const app = express();
const http = Server(app);
const port = process.env.PORT || 4100;

nunjucks.configure('templates', {
  autoescape: true,
  watch: true,
  express: app,
});

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
  // redirect to HTTPS
  app.use((req, res, next) => {
    let isHttps = req.secure;
    // check proto
    if (!isHttps) {
      isHttps = ((req.headers['x-forwarded-proto'] || '').substring(0, 5) === 'https');
    }
    if (isHttps) {
      next();
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      res.redirect(301, config.get('app:host') + (req.originalUrl || '').split('?')[0]);
    } else {
      res.status(403).send('Please use HTTPS');
    }
  });
}

app.use(cors());
app.use(compress());
app.use(bodyParser.urlencoded({
  extended: true,
  limit: config.get('api:payload:maxsize'),
}));
app.use(bodyParser.json({ limit: config.get('api:payload:maxsize') }));

app.use((req, res, next) => {
  // Get Ip address
  req.ip = req.headers['true-client-ip']
    || req.headers['cf-connecting-ip']
    || req.headers['x-forwarded-for']
    || req.ip
    || req.socket.remoteAddress;

  // Generate a unique transaction id
  req.transactionId = nanoid();

  next();
});

// Serve the Swagger JSON
app.get('/docs/v1/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

// Serve the API documentation using redoc-express
app.get('/docs/v1', (req, res) => {
  res.render('docs.html');
});

// Serve the API documentation using redoc-express
app.get('/docs', (req, res) => {
  res.redirect('/docs/v1');
});

app.get('/_/health', (req, res) => {
  res.json({
    status: 'up',
  });
});

app.use('/v1', OpenApiValidator.middleware({
  apiSpec: swaggerSpec,
  validateRequests: true,
  validateResponses: false,
}), v1Router);

// Serve the API documentation using redoc-express
app.get('/', (req, res) => {
  res.render('index.html');
});

sentry.expressError(app);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // format error
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });

  logTransaction(req, res);
});

function start() {
  app.listen(port, () => {
    logger.system(`Listening connection on port ${port}`);
  });
  initializeQueue();
}

module.exports = {
  app,
  http,
  start,
};
