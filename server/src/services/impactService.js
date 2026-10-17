const { ResourceRequest, EmergencyRequest, User, Resource } = require('../models');
const { impact } = require('../config/scoring');
const { RANGES, buckets, startFor, estimateCo2e } = require('../utils/impactMath');

async function getImpact(range = 'month') {
  const start = startFor(range);
  const fmt = RANGES[range].unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const completed = { status: 'COMPLETED', completedAt: { $gte: start } };

  const [byType, byCategory, contributors, series, emergenciesResolved, helpers, verifiedOrgs, orgActivity, allTime, emergencySeries, allTimeByCategory, openEmergencies, activeListings] = await Promise.all([
    ResourceRequest.aggregate([{ $match: completed }, { $group: { _id: '$requestType', count: { $sum: 1 }, items: { $sum: '$quantity' } } }]),
    ResourceRequest.aggregate([{ $match: completed }, { $group: { _id: '$resourceSnapshot.category', items: { $sum: '$quantity' } } }]),
    ResourceRequest.aggregate([{ $match: completed }, { $group: { _id: '$owner' } }, { $count: 'n' }]),
    ResourceRequest.aggregate([
      { $match: completed },
      { $group: { _id: { d: { $dateToString: { format: fmt, date: '$completedAt' } }, t: '$requestType' }, count: { $sum: 1 } } },
    ]),
    EmergencyRequest.countDocuments({ status: 'FULFILLED', fulfilledAt: { $gte: start } }),
    EmergencyRequest.aggregate([
      { $match: { status: 'FULFILLED', fulfilledAt: { $gte: start } } },
      { $project: { n: { $size: { $filter: { input: '$responses', as: 'r', cond: { $eq: ['$$r.status', 'ACCEPTED'] } } } } } },
      { $group: { _id: null, n: { $sum: '$n' } } },
    ]),
    User.countDocuments({ role: 'ORGANIZATION', 'organizationDetails.verificationStatus': 'VERIFIED' }),
    ResourceRequest.aggregate([
      { $match: completed },
      { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'o' } },
      { $unwind: '$o' },
      { $match: { 'o.role': 'ORGANIZATION' } },
      { $group: { _id: '$owner' } },
      { $count: 'n' },
    ]),
    ResourceRequest.countDocuments({ status: 'COMPLETED' }),
    EmergencyRequest.aggregate([
      { $match: { status: 'FULFILLED', fulfilledAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$fulfilledAt' } }, n: { $sum: 1 } } },
    ]),
    ResourceRequest.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: '$resourceSnapshot.category', items: { $sum: '$quantity' } } }]),
    EmergencyRequest.countDocuments({ status: { $in: ['OPEN', 'MATCHED'] } }),
    Resource.countDocuments({ status: 'AVAILABLE' }),
  ]);

  const t = Object.fromEntries(byType.map((x) => [x._id, x]));
  const donations = t.DONATE?.count || 0;
  const borrowShare = (t.BORROW?.count || 0) + (t.SHARE?.count || 0);
  const itemsReused = byType.reduce((s, x) => s + x.items, 0);

  const labels = buckets(range);
  const map = new Map(labels.map((l) => [l, { label: l, DONATE: 0, BORROW: 0, SHARE: 0, donations: 0, borrowShare: 0, emergenciesFulfilled: 0 }]));
  series.forEach((s) => {
    const row = map.get(s._id.d);
    if (!row) return;
    row[s._id.t] += s.count;
    if (s._id.t === 'DONATE') row.donations += s.count; else row.borrowShare += s.count;
  });
  emergencySeries.forEach((e) => { const row = map.get(e._id); if (row) row.emergenciesFulfilled = e.n; });
  const timeline = [...map.values()];

  return {
    range,
    since: start,
    totals: {
      completedDonations: donations,
      borrowAndShareExchanges: borrowShare,
      resourcesReused: itemsReused,
      activeContributors: contributors[0]?.n || 0,
      communityNeedsFulfilled: helpers[0]?.n || 0,
      emergenciesResolved,
      verifiedOrganizations: verifiedOrgs,
      organizationsContributing: orgActivity[0]?.n || 0,
      allTimeCompletedExchanges: allTime,
      openEmergencies,
      activeListings,
    },
    series: timeline,
    timeline, // alias of `series` (same rows): label, DONATE, BORROW, SHARE, donations, borrowShare, emergenciesFulfilled
    byCategory: byCategory.map((c) => ({ category: c._id || 'other', units: c.items })).sort((a, b) => b.units - a.units),
    assumptions: { byCategory: impact.kgCo2ePerItem, default: impact.defaultKgCo2ePerItem },
    allTime: { kgCo2e: estimateCo2e(allTimeByCategory.map((c) => ({ category: c._id, quantity: c.items }))) },
    environmentalEstimate: {
      kgCo2e: estimateCo2e(byCategory.map((c) => ({ category: c._id, quantity: c.items }))),
      isEstimate: true,
      method: impact.label,
      note: 'Estimated avoided emissions from reusing items instead of producing new ones, using the per-category factors in server/src/config/scoring.js.',
    },
  };
}

module.exports = { getImpact };
