/**
 * Endpoints and response fields the React client relies on (pending reviews, rewards ledger, sign-out-everywhere,
 * viewerRequest, trust breakdown, richer impact data). Run: npm test --prefix server
 */
const { connect, clear, disconnect, makeApp, client, signup, resourceBody } = require('./helpers');

let app;
beforeAll(async () => { await connect(); app = makeApp(); });
afterAll(disconnect);
beforeEach(clear);

const API = '/api/v1';
const setStatus = (who, id, status) => who.c.patch(`${API}/requests/${id}/status`, { status });

async function completedDonation() {
  const owner = await signup(app);
  const requester = await signup(app);
  const res = await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: 'DONATE', category: 'books', title: 'Class 10 books' }));
  const rid = res.body.data._id;
  const reqRes = await requester.c.post(`${API}/requests`, { resourceId: rid, quantity: 1, message: 'Please' });
  expect(reqRes.status).toBe(201);
  const id = reqRes.body.data._id;
  for (const s of ['APPROVED', 'IN_PROGRESS', 'COMPLETED']) expect((await setStatus(owner, id, s)).status).toBe(200);
  return { owner, requester, rid, id };
}

describe('client contract', () => {
  it('lists completed exchanges that still need a review, and clears them once reviewed', async () => {
    const { owner, requester, id } = await completedDonation();
    const before = await requester.c.get(`${API}/users/me/pending-reviews`);
    expect(before.status).toBe(200);
    expect(before.body.data.map((x) => x._id)).toContain(id);
    expect(before.body.data[0].resource.title).toBe('Class 10 books');

    expect((await requester.c.post(`${API}/reviews`, { requestId: id, rating: 5, comment: 'Great' })).status).toBe(201);
    expect((await requester.c.get(`${API}/users/me/pending-reviews`)).body.data).toHaveLength(0);
    expect((await owner.c.get(`${API}/users/me/pending-reviews`)).body.data).toHaveLength(1); // the owner has not reviewed yet
  });

  it('exposes the reward ledger and a trust breakdown that add up to the score', async () => {
    const { owner } = await completedDonation();
    const ledger = await owner.c.get(`${API}/users/me/rewards`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.data).toHaveLength(1);
    expect(ledger.body.data[0].points).toBeGreaterThan(0);

    const activity = (await owner.c.get(`${API}/users/me/activity`)).body.data;
    const sum = Object.values(activity.trustBreakdown).reduce((a, b) => a + b, 0);
    expect(Math.abs(Math.max(0, Math.min(100, sum)) - activity.trustScore)).toBeLessThanOrEqual(1);
  });

  it('shows the viewer their open request on the resource, but not other people', async () => {
    const owner = await signup(app);
    const requester = await signup(app);
    const other = await signup(app);
    const rid = (await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: 'DONATE', category: 'books', quantity: 3 }))).body.data._id;
    const reqId = (await requester.c.post(`${API}/requests`, { resourceId: rid, quantity: 1 })).body.data._id;

    expect((await requester.c.get(`${API}/resources/${rid}`)).body.data.viewerRequest).toMatchObject({ _id: reqId, status: 'PENDING' });
    expect((await other.c.get(`${API}/resources/${rid}`)).body.data.viewerRequest).toBeUndefined();
    expect((await owner.c.get(`${API}/resources/${rid}`)).body.data.viewerRequest).toBeUndefined();
  });

  it('"sign out of all devices" revokes every session, including the current one', async () => {
    const { c, email } = await signup(app);
    const phone = client(app);
    expect((await phone.post(`${API}/auth/login`, { email, password: 'Passw0rd!' })).status).toBe(200);
    expect((await c.post(`${API}/auth/logout-all`)).status).toBe(200);
    expect((await phone.get(`${API}/auth/me`)).status).toBe(401);
    expect((await c.get(`${API}/auth/me`)).status).toBe(401);
    expect((await client(app).post(`${API}/auth/logout-all`)).status).toBe(401);
  });

  it('marks a conversation read via PATCH as well as POST', async () => {
    const owner = await signup(app);
    const requester = await signup(app);
    const rid = (await owner.c.post(`${API}/resources`, resourceBody({ availabilityType: 'DONATE', category: 'books' }))).body.data._id;
    const reqId = (await requester.c.post(`${API}/requests`, { resourceId: rid, quantity: 1 })).body.data._id;
    const conv = (await requester.c.post(`${API}/conversations`, { requestId: reqId })).body.data;
    await requester.c.post(`${API}/conversations/${conv._id}/messages`, { content: 'Hello!' });
    expect((await owner.c.patch(`${API}/conversations/${conv._id}/read`)).body.data.updated).toBe(1);
  });

  it('returns chart-ready impact data (timeline, categories, assumptions) and lists moderations for the user', async () => {
    await completedDonation();
    const impact = (await client(app).get(`${API}/impact?range=week`)).body.data;
    expect(impact.timeline).toHaveLength(7);
    expect(impact.timeline.reduce((n, r) => n + r.DONATE, 0)).toBe(1);
    expect(impact.byCategory[0]).toMatchObject({ category: 'books', units: 1 });
    expect(impact.assumptions.default).toBeGreaterThan(0);
    expect(impact.totals.openEmergencies).toBe(0);

    const { c } = await signup(app);
    expect((await c.get(`${API}/users/me/moderations`)).body.data).toEqual([]);
  });
});
