const http = require('http');
const { io: ioc } = require('socket.io-client');
const { connect, clear, disconnect, makeApp, signup, resourceBody } = require('./helpers');

let server; let url; let app;
beforeAll(async () => {
  await connect();
  app = makeApp();
  server = http.createServer(app);
  require('../src/sockets').initSockets(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise((r) => server.close(r)); await disconnect(); });
beforeEach(clear);

const API = '/api/v1';
const sockets = [];
const socketFor = async (who) => {
  const { body } = await who.c.get(`${API}/auth/socket-token`);
  const s = ioc(url, { auth: { token: body.data.token }, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
  return s;
};
afterEach(() => { sockets.splice(0).forEach((s) => s.close()); });
const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const once = (s, ev, ms = 3000) => new Promise((res, rej) => { s.once(ev, res); setTimeout(() => rej(new Error(`timeout waiting for ${ev}`)), ms); });

describe('Socket.IO access control and delivery', () => {
  it('rejects unauthenticated and invalid connections', async () => {
    const anon = ioc(url, { transports: ['websocket'], reconnection: false });
    sockets.push(anon);
    await expect(new Promise((res, rej) => { anon.on('connect', res); anon.on('connect_error', rej); })).rejects.toThrow(/unauthorized/);
    const bad = ioc(url, { auth: { token: 'not-a-jwt' }, transports: ['websocket'], reconnection: false });
    sockets.push(bad);
    await expect(new Promise((res, rej) => { bad.on('connect', res); bad.on('connect_error', rej); })).rejects.toThrow(/unauthorized/);
  });

  it('delivers messages in real time to participants, blocks outsiders, and persists messages', async () => {
    const owner = await signup(app);
    const requester = await signup(app);
    const outsider = await signup(app);
    const rid = (await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: 'DONATE', category: 'books' }))).body.data._id;
    const reqId = (await requester.c.post(`${API}/requests`, { resourceId: rid, quantity: 1, handoverMethod: 'PICKUP' })).body.data._id;
    const conv = (await requester.c.post(`${API}/conversations`, { requestId: reqId })).body.data._id;

    const [so, sr, sx] = await Promise.all([socketFor(owner), socketFor(requester), socketFor(outsider)]);
    expect((await emit(so, 'conversation:join', conv)).ok).toBe(true);
    expect((await emit(sr, 'conversation:join', conv)).ok).toBe(true);
    expect((await emit(sx, 'conversation:join', conv)).ok).toBe(false); // outsiders cannot join the room

    const incoming = once(so, 'message:new');
    const notification = once(so, 'notification:new');
    const ack = await emit(sr, 'message:send', { conversationId: conv, content: 'Live hello' });
    expect(ack.ok).toBe(true);
    expect((await incoming).content).toBe('Live hello');
    expect((await notification).type).toBe('MESSAGE_NEW');
    expect((await emit(sx, 'message:send', { conversationId: conv, content: 'intruder' })).ok).toBe(false);

    const history = await owner.c.get(`${API}/conversations/${conv}/messages`);
    expect(history.body.data.map((m) => m.content)).toEqual(['Live hello']); // survives reloads
  });
});
