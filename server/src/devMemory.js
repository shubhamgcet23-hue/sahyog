/**
 * Zero-setup development: runs the API against a throw-away in-memory MongoDB seeded with demo data.
 *   npm run dev:memory            (from the project root)
 * Data is lost when the process stops. The first run downloads a MongoDB binary (~100 MB, then cached).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = `${mongod.getUri()}sahyog`; // set BEFORE config/env is loaded
  const mongoose = require('mongoose');
  const { connectDB, disconnectDB } = require('./config/db');
  const models = require('./models');
  await connectDB();
  await Promise.all(Object.values(models).map((m) => m.init()));
  await require('./utils/seed').seedDemo({ reset: true });
  await disconnectDB();
  mongoose.connection.removeAllListeners('disconnected'); // keep the log quiet when server.js reconnects
  // eslint-disable-next-line no-console
  console.log('\nIn-memory database ready. Log in as asha@sahyog.local / Sahyog@123 or admin@sahyog.local / Sahyog@123\n');
  process.on('exit', () => mongod.stop());
  require('./server');
})().catch((e) => { console.error(e); process.exit(1); });
