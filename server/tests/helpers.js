const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'sahyog-test' });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // 2dsphere + unique indexes
  await require('../src/services/categoryService').ensureDefaults();
}
async function clear() {
  const keep = ['categories'];
  for (const c of await mongoose.connection.db.collections()) if (!keep.includes(c.collectionName)) await c.deleteMany({});
}
async function disconnect() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

const makeApp = () => require('../src/app').createApp();

/** A signed-in client: persists the session cookie and adds the CSRF header automatically. */
function client(app) {
  const agent = request.agent(app);
  const wrap = (m) => (url, body) => {
    const r = agent[m](url).set(XHR);
    return body !== undefined && m !== 'get' && m !== 'delete' ? r.send(body) : r;
  };
  return { agent, get: wrap('get'), post: wrap('post'), patch: wrap('patch'), delete: wrap('delete') };
}

let seq = 0;
async function signup(app, overrides = {}) {
  seq += 1;
  const c = client(app);
  const body = { name: `User ${seq}`, email: `user${seq}-${Date.now()}@test.dev`, password: 'Passw0rd!', ...overrides };
  const res = await c.post('/api/v1/auth/register', body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { c, user: res.body.data.user, email: body.email, password: body.password };
}

async function makeAdmin(app) {
  const { User } = require('../src/models');
  const bcrypt = require('bcryptjs');
  const email = `admin${Date.now()}@test.dev`;
  await User.create({ name: 'Admin', email, passwordHash: await bcrypt.hash('Passw0rd!', 4), role: 'ADMIN' });
  const c = client(app);
  const res = await c.post('/api/v1/auth/login', { email, password: 'Passw0rd!' });
  if (res.status !== 200) throw new Error('admin login failed');
  return { c, user: res.body.data.user };
}

const resourceBody = (o = {}) => ({
  title: 'Cordless drill', description: 'A reliable cordless drill with two batteries.', category: 'tools', condition: 'GOOD',
  availabilityType: 'BORROW', quantity: 1, lat: 28.4744, lng: 77.504, areaLabel: 'Greater Noida', addressDetail: 'Gate 2, flat 14', ...o,
});
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString();

module.exports = { connect, clear, disconnect, makeApp, client, signup, makeAdmin, resourceBody, inDays };
