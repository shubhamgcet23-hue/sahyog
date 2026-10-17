const { User, Resource, ResourceRequest, EmergencyRequest, Report, OrgVerification, Category, AuditLog, Review } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex } = require('../utils/geo');
const audit = require('../middleware/audit');
const { notify } = require('../services/notificationService');
const trust = require('../services/trustService');
const reports = require('../services/reportService');
const inventory = require('../services/inventoryService');
const impact = require('../services/impactService');
const { buckets, startFor, RANGES } = require('../utils/impactMath');

const ACTIVE = ['PENDING', 'APPROVED', 'IN_PROGRESS'];

exports.overview = asyncHandler(async (_req, res) => {
  const [users, orgsActive, verifiedOrgs, resources, pendingVerifications, activeRequests, completedExchanges, openEmergencies, pendingReports, pendingAppeals, rReq, rRes, rUsers, rAudit] = await Promise.all([
    User.countDocuments({ role: 'USER' }),
    User.countDocuments({ role: 'ORGANIZATION', accountStatus: 'ACTIVE' }),
    User.countDocuments({ role: 'ORGANIZATION', 'organizationDetails.verificationStatus': 'VERIFIED' }),
    Resource.countDocuments({}),
    OrgVerification.countDocuments({ status: 'PENDING' }),
    ResourceRequest.countDocuments({ status: { $in: ACTIVE } }),
    ResourceRequest.countDocuments({ status: 'COMPLETED' }),
    EmergencyRequest.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW', 'MATCHED'] } }),
    Report.countDocuments({ status: { $in: ['PENDING', 'REVIEWING'] } }),
    Report.countDocuments({ 'appeal.status': 'PENDING' }),
    ResourceRequest.find().sort({ createdAt: -1 }).limit(6).select('resourceSnapshot.title status createdAt requestType'),
    Resource.find().sort({ createdAt: -1 }).limit(6).select('title availabilityType createdAt'),
    User.find().sort({ createdAt: -1 }).limit(6).select('name role createdAt'),
    AuditLog.find().sort({ createdAt: -1 }).limit(6).populate('admin', 'name'),
  ]);
  const recentActivity = [
    ...rReq.map((r) => ({ type: 'request', text: `${r.requestType.toLowerCase()} request for "${r.resourceSnapshot?.title}" (${r.status})`, at: r.createdAt })),
    ...rRes.map((r) => ({ type: 'listing', text: `New ${r.availabilityType.toLowerCase()} listing "${r.title}"`, at: r.createdAt })),
    ...rUsers.map((u) => ({ type: 'user', text: `${u.name} joined as ${u.role.toLowerCase()}`, at: u.createdAt })),
    ...rAudit.map((a) => ({ type: 'admin', text: `${a.admin?.name || 'Admin'}: ${a.action}`, at: a.createdAt })),
  ].sort((a, b) => b.at - a.at).slice(0, 12);
  ok(res, { counts: { users, orgsActive, verifiedOrgs, resources, pendingVerifications, activeRequests, completedExchanges, openEmergencies, pendingReports, pendingAppeals }, recentActivity });
});

exports.users = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const p = parsePagination(q, { defaultLimit: 20 });
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.status) filter.accountStatus = q.status;
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); filter.$or = [{ name: rx }, { email: rx }, { 'organizationDetails.orgName': rx }]; }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), User.countDocuments(filter)]);
  ok(res, items, pageMeta(p, total));
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'ADMIN') throw new ApiError(400, 'Administrator accounts cannot be suspended here');
  const { status, reason } = req.body;
  target.accountStatus = status;
  target.suspensionReason = status === 'SUSPENDED' ? reason || 'Policy violation' : undefined;
  await target.save();
  await audit(req, `user.${status.toLowerCase()}`, 'User', target._id, { reason });
  await notify({ recipient: target._id, type: 'MODERATION', title: status === 'SUSPENDED' ? 'Your account was suspended' : 'Your account was reactivated', message: reason || '', link: '/settings' });
  ok(res, target);
});

exports.pendingOrganizations = asyncHandler(async (_req, res) => {
  const apps = await OrgVerification.find({ status: 'PENDING' }).sort({ createdAt: 1 }).populate('organization', 'name email phone organizationDetails createdAt');
  ok(res, apps);
});

exports.decideOrganization = asyncHandler(async (req, res) => {
  // :id is the organization's USER id
  const org = await User.findOne({ _id: req.params.id, role: 'ORGANIZATION' });
  if (!org) throw new ApiError(404, 'Organization not found');
  const application = await OrgVerification.findOne({ organization: org._id, status: 'PENDING' }).sort({ createdAt: -1 });
  if (!application) throw new ApiError(409, 'This organization has no pending application');
  const approved = req.body.decision === 'APPROVED';
  application.status = req.body.decision;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.note = req.body.note;
  await application.save();
  org.organizationDetails.verificationStatus = approved ? 'VERIFIED' : 'REJECTED';
  org.organizationDetails.verifiedAt = approved ? new Date() : undefined;
  org.organizationDetails.verificationNote = req.body.note;
  await org.save();
  await trust.recompute(org);
  await audit(req, `organization.${req.body.decision.toLowerCase()}`, 'User', org._id, { note: req.body.note });
  await notify({
    recipient: org._id, type: 'ORG_VERIFICATION', title: approved ? 'Organization verified' : 'Verification not approved',
    message: approved ? 'Your organization is now verified and can publish emergency campaigns.' : `Reason: ${req.body.note || 'not specified'}. You can update your profile and re-apply.`, link: '/organization',
  });
  ok(res, { organization: org, application });
});

exports.reports = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const p = parsePagination(q, { defaultLimit: 20 });
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.targetType) filter.targetType = q.targetType;
  if (q.appeal) filter['appeal.status'] = 'PENDING';
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('reporter', 'name').populate('reportedUser', 'name accountStatus'),
    Report.countDocuments(filter),
  ]);
  // attach a short preview of the reported content for moderators
  const withPreview = await Promise.all(items.map(async (r) => {
    let preview;
    if (r.targetType === 'RESOURCE') { const x = await Resource.findById(r.targetId).select('title status'); preview = x && { title: x.title, status: x.status }; }
    if (r.targetType === 'REVIEW') { const x = await Review.findById(r.targetId).select('rating comment moderationStatus'); preview = x && { rating: x.rating, comment: x.comment, status: x.moderationStatus }; }
    if (r.targetType === 'EMERGENCY') { const x = await EmergencyRequest.findById(r.targetId).select('title status'); preview = x && { title: x.title, status: x.status }; }
    if (r.targetType === 'USER') { const x = await User.findById(r.targetId).select('name accountStatus'); preview = x && { title: x.name, status: x.accountStatus }; }
    return { ...r.toJSON(), preview };
  }));
  ok(res, withPreview, pageMeta(p, total));
});

exports.decideReport = asyncHandler(async (req, res) => {
  const { report, summary } = await reports.decide(req.user, req.params.id, req.body);
  await audit(req, 'report.decide', 'Report', report._id, { summary, note: req.body.note });
  ok(res, report);
});

exports.resources = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const p = parsePagination(q, { defaultLimit: 20 });
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); filter.$or = [{ title: rx }, { description: rx }]; }
  const [items, total] = await Promise.all([Resource.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('owner', 'name email'), Resource.countDocuments(filter)]);
  ok(res, items, pageMeta(p, total));
});

exports.moderateResource = asyncHandler(async (req, res) => {
  const r = await Resource.findById(req.params.id);
  if (!r) throw new ApiError(404, 'Resource not found');
  r.status = req.body.status;
  r.hiddenReason = req.body.status === 'HIDDEN' ? req.body.reason || 'Hidden by moderator' : undefined;
  await r.save();
  if (req.body.status === 'AVAILABLE') await inventory.syncStatus(r._id);
  await audit(req, `resource.${req.body.status.toLowerCase()}`, 'Resource', r._id, { reason: req.body.reason });
  await notify({ recipient: r.owner, type: 'MODERATION', title: req.body.status === 'HIDDEN' ? 'Your listing was hidden' : 'Your listing was restored', message: `"${r.title}" ${req.body.reason ? `- ${req.body.reason}` : ''}`, relatedResource: r._id, link: '/my-listings' });
  ok(res, r);
});

exports.emergencies = asyncHandler(async (_req, res) => {
  const items = await EmergencyRequest.find({ status: { $in: ['OPEN', 'UNDER_REVIEW', 'MATCHED'] } }).sort({ urgencyRank: 1, createdAt: -1 }).limit(50).populate('creator', 'name role');
  ok(res, items);
});

exports.categories = asyncHandler(async (_req, res) => ok(res, await Category.find().sort({ sortOrder: 1, name: 1 })));
exports.createCategory = asyncHandler(async (req, res) => {
  const slug = req.body.slug || req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cat = await Category.create({ ...req.body, slug });
  await audit(req, 'category.create', 'Category', cat._id, { slug });
  created(res, cat);
});
exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!cat) throw new ApiError(404, 'Category not found');
  await audit(req, 'category.update', 'Category', cat._id, req.body);
  ok(res, cat);
});
exports.deleteCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  if (await Resource.exists({ category: cat.slug })) throw new ApiError(409, 'Category is in use - deactivate it instead of deleting');
  await cat.deleteOne();
  await audit(req, 'category.delete', 'Category', cat._id, { slug: cat.slug });
  ok(res, { message: 'Category deleted' });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 30 });
  const [items, total] = await Promise.all([AuditLog.find().sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('admin', 'name'), AuditLog.countDocuments()]);
  ok(res, items, pageMeta(p, total));
});

/** Platform analytics: impact stats + growth time series + breakdowns (all real aggregates). */
exports.analytics = asyncHandler(async (req, res) => {
  const range = req.validatedQuery.range;
  const start = startFor(range);
  const fmt = RANGES[range].unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const series = (Model, field = 'createdAt', match = {}) => Model.aggregate([
    { $match: { ...match, [field]: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: fmt, date: `$${field}` } }, n: { $sum: 1 } } },
  ]);
  const [impactData, usersS, resS, reqS, statusBreakdown, categoryBreakdown, typeBreakdown] = await Promise.all([
    impact.getImpact(range),
    series(User), series(Resource), series(ResourceRequest),
    ResourceRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Resource.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Resource.aggregate([{ $group: { _id: '$availabilityType', n: { $sum: 1 } } }]),
  ]);
  const idx = (arr) => Object.fromEntries(arr.map((x) => [x._id, x.n]));
  const [u, r, q] = [idx(usersS), idx(resS), idx(reqS)];
  ok(res, {
    range,
    impact: impactData,
    growth: buckets(range).map((label) => ({ label, users: u[label] || 0, listings: r[label] || 0, requests: q[label] || 0 })),
    requestStatus: statusBreakdown.map((x) => ({ label: x._id, value: x.n })),
    listingsByCategory: categoryBreakdown.map((x) => ({ label: x._id, value: x.n })),
    listingsByType: typeBreakdown.map((x) => ({ label: x._id, value: x.n })),
  });
});
