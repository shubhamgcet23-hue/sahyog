const scoring = require('../config/scoring');

/**
 * Pure trust-score formula (no database access, unit-tested). Every term is bounded so the result is always 0..100.
 * @param {{completedExchanges:number, fulfillmentRate:number|null, avgRating:number|null, ratingCount:number, isVerifiedOrg:boolean, confirmedViolations:number}} s
 */
function computeTrustScore(s, cfg = scoring.trust) {
  let score = cfg.base;
  score += Math.min(s.completedExchanges * cfg.perCompletedExchange, cfg.completedExchangeCap);
  if (s.fulfillmentRate !== null && s.fulfillmentRate !== undefined) score += s.fulfillmentRate * cfg.fulfillmentWeight;
  if (s.avgRating !== null && s.avgRating !== undefined && s.ratingCount > 0) {
    const confidence = Math.min(s.ratingCount / cfg.ratingConfidenceReviews, 1);
    score += ((s.avgRating - 3) / 2) * cfg.ratingWeight * confidence;
  }
  if (s.isVerifiedOrg) score += cfg.verifiedOrganizationBonus;
  score -= s.confirmedViolations * cfg.confirmedViolationPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * The same formula, but returning each term so the UI can show *why* a score is what it is (transparency).
 * Terms are unrounded-sum compatible: base + exchanges + fulfilment + rating + verifiedOrganization + violationPenalty.
 */
function explainTrustScore(s, cfg = scoring.trust) {
  const round1 = (n) => Math.round(n * 10) / 10;
  const out = {
    base: cfg.base,
    exchanges: round1(Math.min(s.completedExchanges * cfg.perCompletedExchange, cfg.completedExchangeCap)),
    fulfilment: 0,
    rating: 0,
    verifiedOrganization: 0,
    violationPenalty: 0,
  };
  if (s.fulfillmentRate !== null && s.fulfillmentRate !== undefined) out.fulfilment = round1(s.fulfillmentRate * cfg.fulfillmentWeight);
  if (s.avgRating !== null && s.avgRating !== undefined && s.ratingCount > 0) {
    const confidence = Math.min(s.ratingCount / cfg.ratingConfidenceReviews, 1);
    out.rating = round1(((s.avgRating - 3) / 2) * cfg.ratingWeight * confidence);
  }
  if (s.isVerifiedOrg) out.verifiedOrganization = cfg.verifiedOrganizationBonus;
  if (s.confirmedViolations) out.violationPenalty = -s.confirmedViolations * cfg.confirmedViolationPenalty;
  return out;
}

module.exports = { computeTrustScore, explainTrustScore };
