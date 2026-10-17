/**
 * End-to-end API workflows (supertest + in-memory MongoDB). Numbering follows the 12 required workflows.
 * Run:  npm test --prefix server
 */
const { connect, clear, disconnect, makeApp, client, signup, makeAdmin, resourceBody, inDays } = require('./helpers');
const { User, RewardTransaction, Notification, Message, Resource, ResourceRequest, AuditLog } = require('../src/models');

let app;
beforeAll(async () => { await connect(); app = makeApp(); });
afterAll(disconnect);
beforeEach(clear);

const API = '/api/v1';

/** owner lists a resource, requester is a second user */
async function setup(type = 'BORROW', qty = 1) {
  const owner = await signup(app, { phone: '+91 90000 00001' });
  const requester = await signup(app, { phone: '+91 90000 00002' });
  const res = await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: type, quantity: qty, category: type === 'DONATE' ? 'books' : 'tools' }));
  expect(res.status).toBe(201);
  return { owner, requester, rid: res.body.data._id };
}
const ask = (who, rid, extra = {}) => who.c.post(`${API}/requests`, { resourceId: rid, quantity: 1, message: 'Please', handoverMethod: 'PICKUP', ...extra });
const setStatus = (who, id, status, note) => who.c.patch(`${API}/requests/${id}/status`, { status, note });
const complete = async (owner, id) => {
  for (const s of ['APPROVED', 'IN_PROGRESS', 'COMPLETED']) expect((await setStatus(owner, id, s)).status).toBe(200);
};

describe('1. Register and log in', () => {
  it('registers, sets an httpOnly cookie, never returns the password hash, and can log in again', async () => {
    const c = client(app);
    const reg = await c.post(`${API}/auth/register`, { name: 'Asha Rao', email: 'Asha@Test.dev', password: 'Passw0rd!', phone: '+91 98100 00000' });
    expect(reg.status).toBe(201);
    expect(reg.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
    expect(JSON.stringify(reg.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(reg.body.data.user.email).toBe('asha@test.dev');
    expect((await c.get(`${API}/auth/me`)).status).toBe(200);

    const again = client(app);
    expect((await again.post(`${API}/auth/login`, { email: 'asha@test.dev', password: 'wrong' })).status).toBe(401);
    expect((await again.post(`${API}/auth/login`, { email: 'asha@test.dev', password: 'Passw0rd!' })).status).toBe(200);
    expect((await c.post(`${API}/auth/register`, { name: 'Dup', email: 'asha@test.dev', password: 'Passw0rd!' })).status).toBe(409);
    const stored = await User.findOne({ email: 'asha@test.dev' }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe('Passw0rd!');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('validates input with meaningful messages and blocks self-registration as admin', async () => {
    const c = client(app);
    const bad = await c.post(`${API}/auth/register`, { name: 'A', email: 'x', password: '1' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.length).toBeGreaterThan(1);
    expect((await c.post(`${API}/auth/register`, { name: 'Eve', email: 'eve@test.dev', password: 'Passw0rd!', role: 'ADMIN' })).status).toBe(400);
  });

  it('changing the password signs out every other session', async () => {
    const { c, email } = await signup(app);
    const other = client(app);
    expect((await other.post(`${API}/auth/login`, { email, password: 'Passw0rd!' })).status).toBe(200);
    expect((await c.patch(`${API}/auth/change-password`, { currentPassword: 'Passw0rd!', newPassword: 'NewPassw0rd!' })).status).toBe(200);
    expect((await other.get(`${API}/auth/me`)).status).toBe(401);
    expect((await c.get(`${API}/auth/me`)).status).toBe(200); // the session that changed it stays signed in
  });

  it('rejects cookie-authenticated writes that lack the CSRF header', async () => {
    const { c } = await signup(app);
    expect((await c.agent.post(`${API}/requests`).send({})).status).toBe(403);
  });
});

describe('2-3. Create a listing and discover it nearby', () => {
  it('creates a listing and keeps the pickup address private', async () => {
    const { c: owner } = await signup(app);
    const res = await owner.post(`${API}/resources`, resourceBody({ lat: 28.474412, lng: 77.504199 }));
    expect(res.status).toBe(201);
    expect(res.body.data.availableQuantity).toBe(1);
    const id = res.body.data._id;

    const anon = await client(app).get(`${API}/resources/${id}`);
    expect(anon.status).toBe(200);
    expect(anon.body.data.addressDetail).toBeUndefined();
    expect(anon.body.data.location.coordinates).toEqual([77.5, 28.47]); // public coordinates are rounded (~1 km)
    expect(anon.body.data.preciseLocationVisible).toBe(false);
    const mine = await owner.get(`${API}/resources/${id}`);
    expect(mine.body.data.addressDetail).toBe('Gate 2, flat 14');
    expect(mine.body.data.preciseLocationVisible).toBe(true);
  });

  it('validates listing input on the server', async () => {
    const { c } = await signup(app);
    expect((await c.post(`${API}/resources`, resourceBody({ category: 'nope' }))).status).toBe(400);
    expect((await c.post(`${API}/resources`, resourceBody({ quantity: 0 }))).status).toBe(400);
    expect((await c.post(`${API}/resources`, resourceBody({ title: 'x' }))).status).toBe(400);
    expect((await client(app).post(`${API}/resources`, resourceBody())).status).toBe(401);
  });

  it('finds nearby resources with distance, radius, filters and pagination', async () => {
    const { c } = await signup(app);
    await c.post(`${API}/resources`, resourceBody({ title: 'Near drill', lat: 28.47, lng: 77.5 }));
    await c.post(`${API}/resources`, resourceBody({ title: 'Near books', category: 'books', availabilityType: 'DONATE', lat: 28.48, lng: 77.51 }));
    await c.post(`${API}/resources`, resourceBody({ title: 'Far away drill', lat: 19.07, lng: 72.87 })); // Mumbai

    const near = await c.get(`${API}/resources?lat=28.47&lng=77.5&radiusKm=25&sort=nearest`);
    expect(near.status).toBe(200);
    expect(near.body.data.map((r) => r.title)).toEqual(['Near drill', 'Near books']);
    expect(near.body.data[0].distanceKm).toBe(0);
    expect(near.body.data[1].distanceKm).toBeGreaterThan(0);
    expect(near.body.data.every((r) => r.addressDetail === undefined)).toBe(true);

    expect((await c.get(`${API}/resources?lat=28.47&lng=77.5&type=DONATE`)).body.data).toHaveLength(1);
    expect((await c.get(`${API}/resources?q=books`)).body.data).toHaveLength(1);
    expect((await c.get(`${API}/resources?category=tools`)).body.meta.total).toBe(2);
    const page = await c.get(`${API}/resources?limit=1&page=2`);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.totalPages).toBe(3);
    const map = await c.get(`${API}/resources/nearby?lat=28.47&lng=77.5&radiusKm=10`);
    expect(map.body.data).toHaveLength(2);
  });

  it('only the owner can edit or delete a listing', async () => {
    const { c: owner } = await signup(app);
    const { c: other } = await signup(app);
    const id = (await owner.post(`${API}/resources`, resourceBody())).body.data._id;
    expect((await other.patch(`${API}/resources/${id}`, { title: 'Hacked title' })).status).toBe(403);
    expect((await other.delete(`${API}/resources/${id}`)).status).toBe(403);
    expect((await owner.patch(`${API}/resources/${id}`, { title: 'Updated drill' })).body.data.title).toBe('Updated drill');
    expect((await owner.delete(`${API}/resources/${id}`)).status).toBe(200);
    expect((await other.get(`${API}/resources/${id}`)).status).toBe(404);
  });
});

describe('4-5. Borrowing request, approve / reject', () => {
  it('requires a future return date for borrowing and blocks self-requests and over-requests', async () => {
    const { owner, requester, rid } = await setup('BORROW', 2);
    expect((await ask(requester, rid)).status).toBe(400); // no return date
    expect((await ask(requester, rid, { proposedReturnDate: inDays(-1) })).status).toBe(400);
    expect((await ask(requester, rid, { proposedReturnDate: inDays(3), quantity: 3 })).status).toBe(400); // more than available
    expect((await ask(owner, rid, { proposedReturnDate: inDays(3) })).status).toBe(400); // own resource
    expect((await ask(requester, rid, { proposedReturnDate: inDays(3) })).status).toBe(201);
    expect((await ask(requester, rid, { proposedReturnDate: inDays(3) })).status).toBe(409); // duplicate active request
  });

  it('owner approves; requester cannot; the precise address unlocks only after approval', async () => {
    const { owner, requester, rid } = await setup('BORROW');
    const reqId = (await ask(requester, rid, { proposedReturnDate: inDays(4) })).body.data._id;
    expect(await Notification.countDocuments({ recipient: owner.user._id, type: 'REQUEST_NEW' })).toBe(1);

    expect((await setStatus(requester, reqId, 'APPROVED')).status).toBe(403);
    const before = await requester.c.get(`${API}/requests/${reqId}`);
    expect(before.body.data.resourceInfo.addressDetail).toBeUndefined();

    expect((await setStatus(owner, reqId, 'APPROVED')).status).toBe(200);
    const after = await requester.c.get(`${API}/requests/${reqId}`);
    expect(after.body.data.resourceInfo.addressDetail).toBe('Gate 2, flat 14');
    expect(await Notification.countDocuments({ recipient: requester.user._id, type: 'REQUEST_APPROVED' })).toBe(1);
    const res = await Resource.findById(rid);
    expect(res.availableQuantity).toBe(0);
    expect(res.status).toBe('UNAVAILABLE');
  });

  it('rejecting leaves inventory untouched and ends the request', async () => {
    const { owner, requester, rid } = await setup('DONATE');
    const reqId = (await ask(requester, rid)).body.data._id;
    expect((await setStatus(owner, reqId, 'REJECTED', 'Gone')).status).toBe(200);
    expect((await Resource.findById(rid)).availableQuantity).toBe(1);
    expect((await setStatus(owner, reqId, 'APPROVED')).status).toBe(409); // terminal state
  });

  it('cancelling an approved request returns the units to the listing', async () => {
    const { owner, requester, rid } = await setup('BORROW');
    const reqId = (await ask(requester, rid, { proposedReturnDate: inDays(2) })).body.data._id;
    await setStatus(owner, reqId, 'APPROVED');
    expect((await Resource.findById(rid)).availableQuantity).toBe(0);
    expect((await requester.c.post(`${API}/requests/${reqId}/cancel`, {})).status).toBe(200);
    const r = await Resource.findById(rid);
    expect(r.availableQuantity).toBe(1);
    expect(r.status).toBe('AVAILABLE');
  });

  it('enforces the lifecycle: handover must start before completion', async () => {
    const { owner, requester, rid } = await setup('BORROW');
    const reqId = (await ask(requester, rid, { proposedReturnDate: inDays(2) })).body.data._id;
    await setStatus(owner, reqId, 'APPROVED');
    expect((await owner.c.post(`${API}/requests/${reqId}/complete`, {})).status).toBe(409);
    expect((await setStatus(owner, reqId, 'IN_PROGRESS')).status).toBe(200);
    expect((await requester.c.post(`${API}/requests/${reqId}/complete`, {})).status).toBe(409); // only the owner confirms
    expect((await owner.c.post(`${API}/requests/${reqId}/complete`, {})).status).toBe(200);
  });

  it('flags overdue borrows', async () => {
    const { owner, requester, rid } = await setup('BORROW');
    const reqId = (await ask(requester, rid, { proposedReturnDate: inDays(2) })).body.data._id;
    await setStatus(owner, reqId, 'APPROVED');
    await ResourceRequest.updateOne({ _id: reqId }, { proposedReturnDate: new Date(Date.now() - 864e5) });
    const mine = await requester.c.get(`${API}/requests/me?overdue=true`);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].isOverdue).toBe(true);
  });
});

describe('6. Messaging between authorized participants only', () => {
  it('creates one conversation per request, persists messages, tracks read state and blocks outsiders', async () => {
    const { owner, requester, rid } = await setup('DONATE');
    const reqId = (await ask(requester, rid)).body.data._id;
    const conv = (await requester.c.post(`${API}/conversations`, { requestId: reqId })).body.data;
    expect((await owner.c.post(`${API}/conversations`, { requestId: reqId })).body.data._id).toBe(conv._id); // same thread

    expect((await requester.c.post(`${API}/conversations/${conv._id}/messages`, { content: 'Hello, is it still available?' })).status).toBe(201);
    expect((await requester.c.post(`${API}/conversations/${conv._id}/messages`, { content: '   ' })).status).toBe(400);
    expect(await Message.countDocuments({ conversation: conv._id })).toBe(1); // persisted in MongoDB

    const list = await owner.c.get(`${API}/conversations`);
    expect(list.body.data[0].unread).toBe(1);
    expect(list.body.data[0].lastMessage.content).toMatch(/Hello/);
    expect(await Notification.countDocuments({ recipient: owner.user._id, type: 'MESSAGE_NEW' })).toBe(1);

    expect((await owner.c.get(`${API}/conversations/${conv._id}/messages`)).body.data).toHaveLength(1);
    await owner.c.post(`${API}/conversations/${conv._id}/read`, {});
    expect((await owner.c.get(`${API}/conversations`)).body.data[0].unread).toBe(0);

    const outsider = await signup(app);
    expect((await outsider.c.get(`${API}/conversations/${conv._id}/messages`)).status).toBe(403);
    expect((await outsider.c.post(`${API}/conversations/${conv._id}/messages`, { content: 'hi' })).status).toBe(403);
    expect((await outsider.c.post(`${API}/conversations`, { requestId: reqId })).status).toBe(403);
  });
});

describe('7-9. Complete an exchange, review it, earn points exactly once', () => {
  it('completes a donation, awards points once, updates trust, and survives concurrent double-completion', async () => {
    const { owner, requester, rid } = await setup('DONATE', 3);
    const reqId = (await ask(requester, rid, { quantity: 2 })).body.data._id;
    await setStatus(owner, reqId, 'APPROVED');
    await setStatus(owner, reqId, 'IN_PROGRESS');
    expect((await Resource.findById(rid)).availableQuantity).toBe(1);

    const [a, b] = await Promise.all([owner.c.post(`${API}/requests/${reqId}/complete`, {}), owner.c.post(`${API}/requests/${reqId}/complete`, {})]);
    expect([a.status, b.status].sort()).toEqual([200, 409]); // exactly one wins
    expect((await owner.c.post(`${API}/requests/${reqId}/complete`, {})).status).toBe(409);

    const ledger = await RewardTransaction.find({ user: owner.user._id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].points).toBe(20);
    const refreshed = await User.findById(owner.user._id);
    expect(refreshed.rewardPoints).toBe(20);
    expect(refreshed.trustScore).toBeGreaterThan(50);
    const res = await Resource.findById(rid);
    expect(res.quantity).toBe(1); // donated units leave the stock for good
    expect(res.availableQuantity).toBe(1);
  });

  it('borrow-and-return rewards both parties and restores inventory', async () => {
    const { owner, requester, rid } = await setup('BORROW');
    const reqId = (await ask(requester, rid, { proposedReturnDate: inDays(2) })).body.data._id;
    await complete(owner, reqId);
    expect((await User.findById(owner.user._id)).rewardPoints).toBe(10);
    expect((await User.findById(requester.user._id)).rewardPoints).toBe(5);
    expect((await Resource.findById(rid)).availableQuantity).toBe(1);
  });

  it('allows one review per participant per completed exchange, from participants only', async () => {
    const { owner, requester, rid } = await setup('DONATE');
    const reqId = (await ask(requester, rid)).body.data._id;
    expect((await requester.c.post(`${API}/reviews`, { requestId: reqId, rating: 5 })).status).toBe(409); // not completed yet
    await complete(owner, reqId);

    expect((await requester.c.post(`${API}/reviews`, { requestId: reqId, rating: 5, comment: 'Great giver' })).status).toBe(201);
    expect((await requester.c.post(`${API}/reviews`, { requestId: reqId, rating: 1 })).status).toBe(409); // duplicate
    expect((await owner.c.post(`${API}/reviews`, { requestId: reqId, rating: 4 })).status).toBe(201); // the other side may review too
    const outsider = await signup(app);
    expect((await outsider.c.post(`${API}/reviews`, { requestId: reqId, rating: 5 })).status).toBe(403);
    expect((await requester.c.post(`${API}/reviews`, { requestId: reqId, rating: 9 })).status).toBe(400);

    const received = await requester.c.get(`${API}/users/${owner.user._id}/reviews`);
    expect(received.body.data).toHaveLength(1);
    expect(received.body.data[0].rating).toBe(5);
    expect(await Notification.countDocuments({ recipient: owner.user._id, type: 'REVIEW_RECEIVED' })).toBe(1);
  });

  it('users cannot write their own trust score, points or role', async () => {
    const { c, user } = await signup(app);
    expect((await c.patch(`${API}/users/me`, { trustScore: 100, rewardPoints: 999, role: 'ADMIN' })).status).toBe(200); // unknown fields are stripped
    const stored = await User.findById(user._id);
    expect(stored.trustScore).toBe(50);
    expect(stored.rewardPoints).toBe(0);
    expect(stored.role).toBe('USER');
  });
});

describe('inventory consistency', () => {
  it('never oversells: with 1 unit, only one of two concurrent approvals succeeds', async () => {
    const owner = await signup(app);
    const a = await signup(app);
    const b = await signup(app);
    const rid = (await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: 'DONATE', quantity: 1, category: 'books' }))).body.data._id;
    const ra = (await ask(a, rid)).body.data._id;
    const rb = (await ask(b, rid)).body.data._id;
    const results = await Promise.all([ra, rb].map((id) => setStatus(owner, id, 'APPROVED')));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await Resource.findById(rid)).availableQuantity).toBe(0);
  });

  it('cannot lower the quantity below what is reserved, and cannot delete with active exchanges', async () => {
    const { owner, requester, rid } = await setup('DONATE', 3);
    const reqId = (await ask(requester, rid, { quantity: 2 })).body.data._id;
    await setStatus(owner, reqId, 'APPROVED');
    expect((await owner.c.patch(`${API}/resources/${rid}`, { quantity: 1 })).status).toBe(409);
    expect((await owner.c.patch(`${API}/resources/${rid}`, { quantity: 5 })).status).toBe(200);
    expect((await Resource.findById(rid)).availableQuantity).toBe(3);
    expect((await owner.c.delete(`${API}/resources/${rid}`)).status).toBe(409);
  });
});

describe('10. Emergency requests', () => {
  const emergency = (o = {}) => ({ title: 'Need an oxygen concentrator', description: 'Urgent need for a concentrator for a few days.', category: 'medical-equipment', urgency: 'CRITICAL', lat: 28.47, lng: 77.5, areaLabel: 'Greater Noida', ...o });

  it('creates, filters, receives an offer, accepts it, fulfils it and rewards the helper once', async () => {
    const creator = await signup(app);
    const helper = await signup(app);
    const created = await creator.c.post(`${API}/emergencies`, emergency());
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    expect(created.body.data.status).toBe('OPEN');

    const list = await helper.c.get(`${API}/emergencies?category=medical-equipment&urgency=CRITICAL`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].location.coordinates).toEqual([77.5, 28.47]);
    expect((await helper.c.get(`${API}/emergencies?urgency=LOW`)).body.data).toHaveLength(0);

    expect((await creator.c.post(`${API}/emergencies/${id}/respond`, { message: 'me too' })).status).toBe(400); // not your own request
    const offer = await helper.c.post(`${API}/emergencies/${id}/respond`, { message: 'I can lend one for a week', offerType: 'LEND' });
    expect(offer.status).toBe(201);
    expect(await Notification.countDocuments({ recipient: creator.user._id, type: 'EMERGENCY_RESPONSE' })).toBe(1);
    expect((await helper.c.post(`${API}/emergencies/${id}/respond`, { message: 'again please' })).status).toBe(409);

    expect((await creator.c.patch(`${API}/emergencies/${id}/status`, { status: 'FULFILLED' })).status).toBe(409); // accept an offer first
    expect((await helper.c.patch(`${API}/emergencies/${id}/responses/${offer.body.data._id}`, { status: 'ACCEPTED' })).status).toBe(403);
    expect((await creator.c.patch(`${API}/emergencies/${id}/responses/${offer.body.data._id}`, { status: 'ACCEPTED' })).body.data.status).toBe('MATCHED');
    expect((await creator.c.patch(`${API}/emergencies/${id}/status`, { status: 'FULFILLED' })).status).toBe(200);
    expect((await creator.c.patch(`${API}/emergencies/${id}/status`, { status: 'FULFILLED' })).status).toBe(409);

    const ledger = await RewardTransaction.find({ user: helper.user._id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].transactionType).toBe('COMMUNITY_NEED_FULFILLED');
  });
});

describe('11. Organization verification by an administrator', () => {
  it('apply -> admin review -> verified, with notification; ordinary users cannot use admin routes', async () => {
    const org = await signup(app, { role: 'ORGANIZATION', organizationDetails: { orgName: 'Helping Hands', orgType: 'NGO' } });
    const admin = await makeAdmin(app);
    const emergency = { title: 'Blankets for relief camp', description: 'We need warm blankets for 40 families.', category: 'clothing', lat: 28.47, lng: 77.5 };

    expect((await org.c.post(`${API}/emergencies`, emergency)).status).toBe(403); // unverified organizations cannot publish
    expect((await org.c.post(`${API}/organizations/verification`, { message: 'Registered NGO since 2019' })).status).toBe(201);
    expect((await org.c.post(`${API}/organizations/verification`, { message: 'again' })).status).toBe(409); // one open application

    expect((await org.c.get(`${API}/admin/organizations/pending`)).status).toBe(403);
    const pending = await admin.c.get(`${API}/admin/organizations/pending`);
    expect(pending.body.data).toHaveLength(1);
    const decision = await admin.c.patch(`${API}/admin/organizations/${org.user._id}/verification`, { decision: 'APPROVED', note: 'Documents checked' });
    expect(decision.status).toBe(200);
    expect((await User.findById(org.user._id)).organizationDetails.verificationStatus).toBe('VERIFIED');
    expect(await Notification.countDocuments({ recipient: org.user._id, type: 'ORG_VERIFICATION' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'organization.approved' })).toBe(1);
    expect((await org.c.post(`${API}/emergencies`, emergency)).status).toBe(201);
  });
});

describe('12. Unauthorized access is prevented', () => {
  it('protects private routes, admin routes and other users\' data', async () => {
    const anon = client(app);
    for (const url of ['/requests/me', '/notifications', '/conversations', '/users/me/activity', '/admin/overview']) {
      expect((await anon.get(`${API}${url}`)).status).toBe(401);
    }
    const { owner, requester, rid } = await setup('DONATE');
    const reqId = (await ask(requester, rid)).body.data._id;
    const stranger = await signup(app);
    expect((await stranger.c.get(`${API}/requests/${reqId}`)).status).toBe(403);
    expect((await stranger.c.patch(`${API}/requests/${reqId}/status`, { status: 'APPROVED' })).status).toBe(403);
    expect((await stranger.c.get(`${API}/admin/overview`)).status).toBe(403);
    expect((await owner.c.get(`${API}/admin/users`)).status).toBe(403);
  });

  it('resists NoSQL operator injection in login', async () => {
    await signup(app, { email: 'victim@test.dev' });
    const res = await client(app).post(`${API}/auth/login`, { email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('a suspended user is locked out of the app and the admin audit trail records it', async () => {
    const admin = await makeAdmin(app);
    const victim = await signup(app);
    expect((await victim.c.get(`${API}/users/me/activity`)).status).toBe(200);
    expect((await admin.c.patch(`${API}/admin/users/${victim.user._id}/status`, { status: 'SUSPENDED', reason: 'Fraud' })).status).toBe(200);
    expect((await victim.c.get(`${API}/users/me/activity`)).status).toBe(403);
    expect((await victim.c.post(`${API}/resources`, resourceBody())).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: 'user.suspended' })).toBe(1);
    expect((await admin.c.patch(`${API}/admin/users/${admin.user._id}/status`, { status: 'SUSPENDED' })).status).toBe(400); // admins cannot be suspended
    expect((await admin.c.patch(`${API}/admin/users/${victim.user._id}/status`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await victim.c.get(`${API}/users/me/activity`)).status).toBe(200);
  });
});

describe('moderation, appeals, activity and impact', () => {
  it('report -> admin hides content -> owner appeals -> admin overturns and restores', async () => {
    const admin = await makeAdmin(app);
    const owner = await signup(app);
    const reporter = await signup(app);
    const rid = (await owner.c.post(`${API}/resources`, resourceBody())).body.data._id;

    expect((await owner.c.post(`${API}/reports`, { targetType: 'RESOURCE', targetId: rid, reason: 'SPAM' })).status).toBe(400); // own content
    const rep = await reporter.c.post(`${API}/reports`, { targetType: 'RESOURCE', targetId: rid, reason: 'FRAUD', description: 'Looks fake' });
    expect(rep.status).toBe(201);
    expect((await reporter.c.post(`${API}/reports`, { targetType: 'RESOURCE', targetId: rid, reason: 'FRAUD' })).status).toBe(409);

    const reportId = rep.body.data._id;
    expect((await admin.c.patch(`${API}/admin/reports/${reportId}`, { action: 'HIDE_CONTENT', note: 'Misleading listing' })).status).toBe(200);
    expect((await Resource.findById(rid)).status).toBe('HIDDEN');
    expect((await owner.c.get(`${API}/resources/${rid}`)).status).toBe(200); // owner can still see it
    expect((await reporter.c.get(`${API}/resources/${rid}`)).status).toBe(404);
    expect((await User.findById(owner.user._id)).trustScore).toBeLessThan(50); // confirmed violation

    expect((await owner.c.get(`${API}/reports/against-me`)).body.data).toHaveLength(1);
    expect((await owner.c.post(`${API}/reports/${reportId}/appeal`, { message: 'This listing is accurate, please review again.' })).status).toBe(200);
    expect((await admin.c.patch(`${API}/admin/reports/${reportId}`, { appealDecision: 'OVERTURNED', note: 'Verified with owner' })).status).toBe(200);
    expect((await Resource.findById(rid)).status).toBe('AVAILABLE');
    expect((await User.findById(owner.user._id)).trustScore).toBe(50); // penalty removed
  });

  it('exposes real impact statistics with a labelled environmental estimate', async () => {
    const empty = await client(app).get(`${API}/impact?range=month`);
    expect(empty.status).toBe(200);
    expect(empty.body.data.totals.completedDonations).toBe(0);

    const { owner, requester, rid } = await setup('DONATE', 2);
    const reqId = (await ask(requester, rid, { quantity: 2 })).body.data._id;
    await complete(owner, reqId);
    const res = await client(app).get(`${API}/impact?range=month`);
    expect(res.body.data.totals.completedDonations).toBe(1);
    expect(res.body.data.totals.resourcesReused).toBe(2);
    expect(res.body.data.environmentalEstimate.isEstimate).toBe(true);
    expect(res.body.data.environmentalEstimate.kgCo2e).toBeGreaterThan(0);
    expect(res.body.data.series).toHaveLength(30);
    expect((await client(app).get(`${API}/impact?range=decade`)).status).toBe(400);
  });

  it('the user dashboard is computed from real data', async () => {
    const { owner, requester, rid } = await setup('DONATE');
    const reqId = (await ask(requester, rid)).body.data._id;
    const before = await owner.c.get(`${API}/users/me/activity`);
    expect(before.body.data.counts.incomingPending).toBe(1);
    await complete(owner, reqId);
    const after = await owner.c.get(`${API}/users/me/activity`);
    expect(after.body.data.counts.completedExchanges).toBe(1);
    expect(after.body.data.rewardPoints).toBe(20);
  });
});
