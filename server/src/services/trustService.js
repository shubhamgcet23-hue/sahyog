const { User, ResourceRequest, Review, Report } = require('../models');
const { computeTrustScore, explainTrustScore } = require('../utils/trustFormula');

async function gatherStats(user) {
  const id = user._id;
  const [completedExchanges, ownerCompleted, ownerCancelledAfterApproval, ratingAgg, confirmedViolations] = await Promise.all([
    ResourceRequest.countDocuments({ status: 'COMPLETED', $or: [{ owner: id }, { requester: id }] }),
    ResourceRequest.countDocuments({ status: 'COMPLETED', owner: id }),
    ResourceRequest.countDocuments({ status: 'CANCELLED', owner: id, cancelledBy: 'owner', approvedAt: { $exists: true } }),
    Review.aggregate([
      { $match: { reviewee: id, moderationStatus: 'VISIBLE' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Report.countDocuments({
      reportedUser: id,
      status: 'RESOLVED',
      'adminDecision.action': { $in: ['WARN', 'HIDE_CONTENT', 'SUSPEND_USER'] },
      'appeal.status': { $ne: 'OVERTURNED' },
    }),
  ]);
  const denominator = ownerCompleted + ownerCancelledAfterApproval;
  return {
    completedExchanges,
    fulfillmentRate: denominator > 0 ? ownerCompleted / denominator : null,
    avgRating: ratingAgg[0]?.avg ?? null,
    ratingCount: ratingAgg[0]?.count ?? 0,
    isVerifiedOrg: user.role === 'ORGANIZATION' && user.organizationDetails?.verificationStatus === 'VERIFIED',
    confirmedViolations,
  };
}

/** Recompute and persist a user's trust score. Users can never set this directly. */
async function recompute(userOrId) {
  const user = userOrId && userOrId.role ? userOrId : await User.findById(userOrId);
  if (!user) return null;
  const stats = await gatherStats(user);
  const trustScore = computeTrustScore(stats);
  await User.updateOne({ _id: user._id }, { $set: { trustScore } });
  return { trustScore, stats };
}

/** Per-term breakdown of the user's current trust score (for the dashboard). */
async function explain(user) {
  const stats = await gatherStats(user);
  return explainTrustScore(stats);
}

module.exports = { computeTrustScore, recompute, gatherStats, explain };
