const http = require('http');
const mongoose = require('mongoose');
const { env, validateEnv } = require('./config/env');
const logger = require('./utils/logger');

async function main() {
  validateEnv();
  const { connectDB, disconnectDB } = require('./config/db');
  const { createApp } = require('./app');
  const { initSockets } = require('./sockets');
  const { ensureDefaults } = require('./services/categoryService');
  const reminders = require('./services/reminderService');
  const models = require('./models');

  await connectDB();
  // make sure geospatial / unique indexes exist before serving traffic
  await Promise.all(Object.values(models).map((m) => m.init()));
  await ensureDefaults();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  const reminderTimer = reminders.start();

  server.listen(env.PORT, () => logger.info(`Sahyog API listening on :${env.PORT}`, { env: env.NODE_ENV, client: env.CLIENT_URLS }));

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });
    clearInterval(reminderTimer);
    const force = setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 10000);
    force.unref();
    io.close();
    server.close(async () => {
      await disconnectDB();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection', { message: err?.message, stack: env.isProd ? undefined : err?.stack }));
  process.on('uncaughtException', (err) => { logger.error('uncaughtException', { message: err.message, stack: err.stack }); shutdown('uncaughtException'); });
}

main().catch((err) => {
  logger.error('Failed to start server', { message: err.message });
  if (err.code === 'ENV_INVALID') console.error(`\n${err.message}\n\nCopy server/.env.example to server/.env and fill it in.\n`);
  process.exit(1);
});
