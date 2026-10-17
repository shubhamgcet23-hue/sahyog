const mongoose = require('mongoose');
const { env } = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
mongoose.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));

/** Connect with a few retries so a slow Atlas cold start does not crash the process. */
async function connectDB(uri = env.MONGODB_URI, { retries = 4, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      logger.info('MongoDB connected', { host: mongoose.connection.host, db: mongoose.connection.name });
      return mongoose.connection;
    } catch (err) {
      logger.error('MongoDB connection failed', { attempt, retries, message: err.message });
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  return null;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
