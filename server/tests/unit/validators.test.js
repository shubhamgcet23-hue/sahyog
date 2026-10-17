const auth = require('../../src/validators/auth.validators');
const rv = require('../../src/validators/resource.validators');
const qv = require('../../src/validators/request.validators');
const mv = require('../../src/validators/misc.validators');

describe('auth validators', () => {
  const ok = { name: 'Asha', email: 'ASHA@Example.com', password: 'Passw0rdX' };
  test('accepts valid registration and normalises email', () => {
    const r = auth.register.safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('asha@example.com');
    expect(r.data.role).toBe('USER');
  });
  test('rejects weak passwords', () => {
    expect(auth.register.safeParse({ ...ok, password: 'short1' }).success).toBe(false);
    expect(auth.register.safeParse({ ...ok, password: 'allletters' }).success).toBe(false);
    expect(auth.register.safeParse({ ...ok, password: '12345678' }).success).toBe(false);
  });
  test('cannot self-register as ADMIN', () => {
    expect(auth.register.safeParse({ ...ok, role: 'ADMIN' }).success).toBe(false);
  });
  test('organization needs organization details', () => {
    expect(auth.register.safeParse({ ...ok, role: 'ORGANIZATION' }).success).toBe(false);
    expect(auth.register.safeParse({ ...ok, role: 'ORGANIZATION', organizationDetails: { orgName: 'Helpers', orgType: 'NGO' } }).success).toBe(true);
  });
  test('rejects NoSQL operator objects in login', () => {
    expect(auth.login.safeParse({ email: { $gt: '' }, password: 'x' }).success).toBe(false);
  });
});

describe('resource validators', () => {
  const base = { title: 'Drill', description: 'A cordless drill for lending', category: 'tools', condition: 'GOOD', availabilityType: 'BORROW', quantity: '2', lat: '28.47', lng: '77.5' };
  test('coerces multipart strings to numbers', () => {
    const r = rv.create.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data.quantity).toBe(2);
    expect(r.data.lat).toBeCloseTo(28.47);
  });
  test('rejects bad coordinates, quantity and short text', () => {
    expect(rv.create.safeParse({ ...base, lat: '200' }).success).toBe(false);
    expect(rv.create.safeParse({ ...base, quantity: '0' }).success).toBe(false);
    expect(rv.create.safeParse({ ...base, quantity: '1.5' }).success).toBe(false);
    expect(rv.create.safeParse({ ...base, title: 'ab' }).success).toBe(false);
  });
  test('availableTo must not precede availableFrom', () => {
    expect(rv.create.safeParse({ ...base, availableFrom: '2026-05-10', availableTo: '2026-05-01' }).success).toBe(false);
  });
  test('search query defaults', () => {
    const r = rv.list.parse({});
    expect(r.radiusKm).toBe(25);
    expect(r.sort).toBe('newest');
    expect(rv.list.safeParse({ type: 'SELL' }).success).toBe(false);
  });
});

describe('request & misc validators', () => {
  test('request requires a valid resource id', () => {
    expect(qv.create.safeParse({ resourceId: 'nope' }).success).toBe(false);
    expect(qv.create.safeParse({ resourceId: 'a'.repeat(24), quantity: 2 }).success).toBe(true);
  });
  test('status update only allows known statuses', () => {
    expect(qv.updateStatus.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(qv.updateStatus.safeParse({ status: 'APPROVED' }).success).toBe(true);
  });
  test('review rating must be an integer 1-5', () => {
    const id = 'b'.repeat(24);
    expect(mv.createReview.safeParse({ requestId: id, rating: 6 }).success).toBe(false);
    expect(mv.createReview.safeParse({ requestId: id, rating: 4.5 }).success).toBe(false);
    expect(mv.createReview.safeParse({ requestId: id, rating: 5 }).success).toBe(true);
  });
  test('messages cannot be empty', () => {
    expect(mv.sendMessage.safeParse({ content: '   ' }).success).toBe(false);
  });
});
