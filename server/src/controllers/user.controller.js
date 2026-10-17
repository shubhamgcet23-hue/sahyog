const { User, Resource, ResourceRequest, Notification, Conversation, Message, Review, RewardTransaction, Report } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { toPoint } = require('../utils/geo');
const { saveImages, deleteImages } = require('../services/uploadService');
const trust = require('../services/trustService');

exports.getMe = (req, res) => ok(res, { user: req.user });

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, phone, bio, areaLabel, lat, lng, organizationDetails } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (bio !== undefined) user.bio = bio;
  if (areaLabel !== undefined) user.areaLabel = areaLabel;
  if ((lat === undefined) !== (lng === undefined)) throw new ApiError(400, 'Provide both lat and lng');
  if (lat !== undefined) user.location = toPoint(lat, lng);
  if (organizationDetails && user.role === 'ORGANIZATION') {
    Object.entries(organizationDetails).forEach(([k, v]) => { if (v !== undefined) user.organizationDetails[k] = v; }); // verificationStatus is not user-editable
  }
  if (req.file) {
    const [img] = await saveImages([req.file], 'avatars');
    await deleteImages(user.profileImage ? [user.profileImage] : []);
    user.profileImage = img;
  }
  await user.save();
  ok(res, { user });
});

exports.myResources = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const filter = { owner: req.user._id };
  const [items, total] = await Promise.all([
    Resource.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Resource.countDocuments(filter),
  ]);
  // attach pending request counts for the "My listings" page
  const pending = await ResourceRequest.aggregate([
    { $match: { owner: req.user._id, status: 'PENDING', resource: { $in: items.map((i) => i._id) } } },
    { $group: { _id: '$resource', n: { $sum: 1 } } },
  ]);
  const pmap = Object.fromEntries(pending.map((x) => [String(x._id), x.n]));
  ok(res, items.map((i) => ({ ...i.toJSON(), pendingRequests: pmap[String(i._id)] || 0 })), pageMeta(p, total));
});

exports.getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name role bio profileImage trustScore areaLabel createdAt accountStatus organizationDetails.orgName organizationDetails.orgType organizationDetails.website organizationDetails.description organizationDetails.verificationStatus');
  if (!user) throw new ApiError(404, 'User not found');
  const [completed, listings, reviews] = await Promise.all([
    ResourceRequest.countDocuments({ status: 'COMPLETED', $or: [{ owner: user._id }, { requester: user._id }] }),
    Resource.countDocuments({ owner: user._id, status: 'AVAILABLE' }),
    Review.aggregate([{ $match: { reviewee: user._id, moderationStatus: 'VISIBLE' } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
  ]);
  ok(res, { user, stats: { completedExchanges: completed, activeListings: listings, averageRating: reviews[0] ? Math.round(reviews[0].avg * 10) / 10 : null, reviewCount: reviews[0]?.count || 0 } });
});

exports.getUserReviews = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 10 });
  const filter = { reviewee: req.params.id, moderationStatus: 'VISIBLE' };
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('reviewer', 'name profileImage').populate('request', 'resourceSnapshot.title'),
    Review.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(p, total));
});

/** Everything the dashboard needs in one real-data call. */
exports.activity = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const now = new Date();
  const [activeListings, incomingPending, outgoing, completedCount, borrowed, donationHistory, unread, recent, orgStats, ledger, nextActions] = await Promise.all([
    Resource.find({ owner: me, status: { $in: ['AVAILABLE', 'UNAVAILABLE'] } }).sort({ createdAt: -1 }).limit(6),
    ResourceRequest.find({ owner: me, status: 'PENDING' }).sort({ createdAt: -1 }).limit(6).populate('requester', 'name'),
    ResourceRequest.find({ requester: me, status: { $in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } }).sort({ createdAt: -1 }).limit(6).populate('owner', 'name'),
    ResourceRequest.countDocuments({ status: 'COMPLETED', $or: [{ owner: me }, { requester: me }] }),
    ResourceRequest.find({ requester: me, requestType: 'BORROW', status: { $in: ['APPROVED', 'IN_PROGRESS'] } }).sort({ proposedReturnDate: 1 }).limit(10),
    ResourceRequest.find({ requestType: 'DONATE', status: 'COMPLETED', $or: [{ owner: me }, { requester: me }] }).sort({ completedAt: -1 }).limit(8),
    Notification.countDocuments({ recipient: me, isRead: false }),
    Conversation.find({ participants: me }).sort({ lastMessageAt: -1 }).limit(5).populate('participants', 'name'),
    req.user.role === 'ORGANIZATION' ? orgStatsFor(me) : null,
    RewardTransaction.find({ user: me }).sort({ createdAt: -1 }).limit(5),
    ResourceRequest.countDocuments({ owner: me, status: { $in: ['APPROVED', 'IN_PROGRESS'] } }),
  ]);
  const unreadByConv = await Message.aggregate([
    { $match: { conversation: { $in: recent.map((c) => c._id) }, sender: { $ne: me }, readBy: { $ne: me } } },
    { $group: { _id: '$conversation', n: { $sum: 1 } } },
  ]);
  const umap = Object.fromEntries(unreadByConv.map((x) => [String(x._id), x.n]));
  const trustBreakdown = await trust.explain(req.user);
  ok(res, {
    trustBreakdown,
    profile: req.user,
    counts: { activeListings: activeListings.length, incomingPending: incomingPending.length, outgoingActive: outgoing.length, completedExchanges: completedCount, unreadNotifications: unread, inProgressAsOwner: nextActions },
    activeListings, incomingPending, outgoing,
    borrowed: borrowed.map((b) => ({ ...b.toJSON(), isOverdue: b.proposedReturnDate < now })),
    donationHistory,
    rewardPoints: req.user.rewardPoints,
    trustScore: req.user.trustScore,
    recentRewards: ledger,
    recentConversations: recent.map((c) => ({ ...c.toJSON(), unread: umap[String(c._id)] || 0 })),
    organization: orgStats,
  });
});

async function orgStatsFor(id) {
  const [given, received, openRequests, emergencies, myEmergencyResponses, listings] = await Promise.all([
    ResourceRequest.aggregate([{ $match: { owner: id, status: 'COMPLETED' } }, { $group: { _id: null, exchanges: { $sum: 1 }, items: { $sum: '$quantity' } } }]),
    ResourceRequest.aggregate([{ $match: { requester: id, status: 'COMPLETED' } }, { $group: { _id: null, exchanges: { $sum: 1 }, items: { $sum: '$quantity' } } }]),
    ResourceRequest.countDocuments({ owner: id, status: 'PENDING' }),
    require('../models').EmergencyRequest.countDocuments({ creator: id }),
    require('../models').EmergencyRequest.countDocuments({ 'responses.responder': id }),
    Resource.aggregate([{ $match: { owner: id } }, { $group: { _id: '$status', n: { $sum: 1 }, units: { $sum: '$availableQuantity' } } }]),
  ]);
  return {
    distributed: { exchanges: given[0]?.exchanges || 0, items: given[0]?.items || 0 },
    received: { exchanges: received[0]?.exchanges || 0, items: received[0]?.items || 0 },
    openRequests, emergenciesCreated: emergencies, emergencyResponses: myEmergencyResponses,
    inventory: listings,
  };
}

/** Completed exchanges the current user has not reviewed yet (drives the "leave a review" prompts). */
exports.pendingReviews = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const done = await ResourceRequest.find({ status: 'COMPLETED', $or: [{ owner: me }, { requester: me }] })
    .sort({ completedAt: -1 }).limit(50).select('resourceSnapshot completedAt');
  const reviewed = await Review.find({ reviewer: me, request: { $in: done.map((d) => d._id) } }).select('request');
  const seen = new Set(reviewed.map((r) => String(r.request)));
  ok(res, done.filter((d) => !seen.has(String(d._id))).map((d) => ({ _id: d._id, resource: { title: d.resourceSnapshot?.title }, completedAt: d.completedAt })));
});

/** The user's reward ledger (earned and reversed points). */
exports.rewards = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    RewardTransaction.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    RewardTransaction.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(p, total));
});
