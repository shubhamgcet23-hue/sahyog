const { computeTrustScore } = require('../../src/utils/trustFormula');
const cfg = { base: 50, perCompletedExchange: 2, completedExchangeCap: 25, fulfillmentWeight: 10, ratingWeight: 15, ratingConfidenceReviews: 3, verifiedOrganizationBonus: 10, confirmedViolationPenalty: 15 };
const blank = { completedExchanges: 0, fulfillmentRate: null, avgRating: null, ratingCount: 0, isVerifiedOrg: false, confirmedViolations: 0 };

describe('computeTrustScore', () => {
  test('a new user starts at the base score', () => expect(computeTrustScore(blank, cfg)).toBe(50));
  test('completed exchanges raise the score up to the cap', () => {
    expect(computeTrustScore({ ...blank, completedExchanges: 5 }, cfg)).toBe(60);
    expect(computeTrustScore({ ...blank, completedExchanges: 500 }, cfg)).toBe(75);
  });
  test('ratings are weighted by confidence and can lower the score', () => {
    expect(computeTrustScore({ ...blank, avgRating: 5, ratingCount: 3 }, cfg)).toBe(65);
    expect(computeTrustScore({ ...blank, avgRating: 5, ratingCount: 1 }, cfg)).toBe(55);
    expect(computeTrustScore({ ...blank, avgRating: 1, ratingCount: 3 }, cfg)).toBe(35);
  });
  test('verified organizations get a bonus; violations subtract', () => {
    expect(computeTrustScore({ ...blank, isVerifiedOrg: true }, cfg)).toBe(60);
    expect(computeTrustScore({ ...blank, confirmedViolations: 2 }, cfg)).toBe(20);
  });
  test('result is always clamped to 0..100', () => {
    expect(computeTrustScore({ ...blank, confirmedViolations: 99 }, cfg)).toBe(0);
    expect(computeTrustScore({ completedExchanges: 999, fulfillmentRate: 1, avgRating: 5, ratingCount: 50, isVerifiedOrg: true, confirmedViolations: 0 }, cfg)).toBe(100);
  });
});
