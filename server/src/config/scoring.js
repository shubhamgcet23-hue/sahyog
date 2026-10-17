/**
 * Central, configurable business rules for rewards, trust score and impact estimates.
 * Change the numbers here - no other code needs to be touched.
 */
module.exports = {
  // ---- Reward points (non-monetary, never redeemable for cash) ----
  rewards: {
    points: {
      DONATION_COMPLETED: 20,
      SHARE_COMPLETED: 10,
      BORROW_COMPLETED: 10, // lender, when the item is returned
      BORROW_RETURNED: 5, // borrower, for returning the item
      COMMUNITY_NEED_FULFILLED: 25,
    },
    dailyCap: 100, // maximum points a user can earn per UTC day (anti-farming)
  },

  // ---- Trust score (0-100), recomputed from real activity ----
  trust: {
    base: 50,
    perCompletedExchange: 2,
    completedExchangeCap: 25, // max points from completed exchanges
    fulfillmentWeight: 10, // x fulfilment rate (0..1) of approved requests the owner completed
    ratingWeight: 15, // maps average rating 1..5 to -15..+15
    ratingConfidenceReviews: 3, // reviews needed for the rating to count fully
    verifiedOrganizationBonus: 10,
    confirmedViolationPenalty: 15,
  },

  // ---- Business limits ----
  limits: {
    maxBorrowDays: 90,
    maxImages: 5,
    maxImageBytes: 5 * 1024 * 1024,
  },

  // ---- Environmental impact ESTIMATE (kg CO2e avoided per item reused instead of newly produced) ----
  // These are rough, illustrative placeholders for a student/demo project, NOT audited figures.
  // Replace with values from a reliable source (e.g. published LCA data) before making any public claim.
  impact: {
    label: 'Rough estimate based on configurable per-item factors; not audited.',
    kgCo2ePerItem: {
      books: 2.5,
      clothing: 10,
      electronics: 40,
      furniture: 25,
      'medical-equipment': 15,
      food: 1.5,
      tools: 12,
      sports: 8,
      'school-supplies': 1,
      other: 3,
    },
    defaultKgCo2ePerItem: 3,
  },
};
