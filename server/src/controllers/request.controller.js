const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');
const service = require('../services/requestService');
const { Review, Resource, User } = require('../models');
const { approximatePoint } = require('../utils/geo');

exports.create = asyncHandler(async (req, res) => created(res, await service.create(req.user, req.body)));

const listController = (role) => asyncHandler(async (req, res) => {
  const p = parsePagination(req.validatedQuery, { defaultLimit: 20 });
  const { items, total } = await service.listFor(req.user, role, req.validatedQuery, p);
  ok(res, items, pageMeta(p, total));
});
exports.mine = listController('requester');
exports.received = listController('owner');

exports.get = asyncHandler(async (req, res) => {
  const request = await service.getForParty(req.user, req.params.id);
  const out = request.toJSON();
  const resource = await Resource.findById(request.resource).select('+addressDetail title images location areaLabel status');
  const precise = ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(request.status) || req.user.role === 'ADMIN';
  out.resourceInfo = resource ? { ...resource.toJSON(), location: precise ? resource.location : approximatePoint(resource.location, 2), addressDetail: precise ? resource.addressDetail : undefined } : null;
  out.myReview = await Review.findOne({ request: request._id, reviewer: req.user._id });
  out.viewerRole = String(request.owner._id) === String(req.user._id) ? 'owner' : String(request.requester._id) === String(req.user._id) ? 'requester' : 'admin';
  // The other party's phone number is unlocked only while an approved exchange is under way.
  if (['APPROVED', 'IN_PROGRESS'].includes(request.status) && out.viewerRole !== 'admin') {
    const other = await User.findById(out.viewerRole === 'owner' ? request.requester._id : request.owner._id).select('phone');
    if (other?.phone) out.contact = { phone: other.phone };
  }
  ok(res, out);
});

exports.updateStatus = asyncHandler(async (req, res) => ok(res, await service.transition(req.user, req.params.id, req.body.status, req.body.note)));
exports.cancel = asyncHandler(async (req, res) => ok(res, await service.transition(req.user, req.params.id, 'CANCELLED', req.body?.note)));
exports.complete = asyncHandler(async (req, res) => ok(res, await service.transition(req.user, req.params.id, 'COMPLETED', req.body?.note)));
