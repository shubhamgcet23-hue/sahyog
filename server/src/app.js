const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const { env } = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { csrfGuard } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./services/uploadService');
const logger = require('./utils/logger');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render/Vercel proxies: correct client IP for rate limiting
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow the SPA to load /uploads images
  app.use(
    cors({
      origin: (origin, cb) => {
        // no Origin header = non-browser client (curl, tests, server-to-server)
        if (!origin || env.CLIENT_URLS.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  if (!env.isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => logger.info('http', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - start }));
      next();
    });
  }

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $-operators / dotted keys: NoSQL injection guard
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));

  app.use('/api/v1', apiLimiter, csrfGuard, routes);
  app.get('/', (_req, res) => res.json({ name: 'Sahyog API', version: 'v1', docs: '/api/v1/health' }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
