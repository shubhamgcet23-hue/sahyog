const { buckets, estimateCo2e, startFor } = require('../../src/utils/impactMath');

describe('impact math', () => {
  const now = new Date('2026-03-15T10:00:00Z');
  test('week and month use daily buckets, year uses 12 monthly buckets', () => {
    expect(buckets('week', now)).toHaveLength(7);
    expect(buckets('month', now)).toHaveLength(30);
    const year = buckets('year', now);
    expect(year).toHaveLength(12);
    expect(year[11]).toBe('2026-03');
    expect(year[0]).toBe('2025-04');
  });
  test('buckets end today and are ascending', () => {
    const w = buckets('week', now);
    expect(w[6]).toBe('2026-03-15');
    expect(w[0]).toBe('2026-03-09');
  });
  test('startFor returns the first bucket start', () => {
    expect(startFor('week', now).toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });
  test('estimateCo2e uses per-category factors and a default', () => {
    const cfg = { kgCo2ePerItem: { books: 2, tools: 10 }, defaultKgCo2ePerItem: 1 };
    expect(estimateCo2e([{ category: 'books', quantity: 3 }, { category: 'tools', quantity: 1 }, { category: 'unknown', quantity: 4 }], cfg)).toBe(20);
    expect(estimateCo2e([], cfg)).toBe(0);
  });
});
