const { Report } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const service = require('../services/reportService');

exports.create = asyncHandler(async (req, res) => created(res, await service.create(req.user, req.body)));

// Reports where the current user is the responsible party (includes suspended users, so they can appeal)
exports.againstMe = asyncHandler(async (req, res) => {
  const items = await Report.find({ reportedUser: req.user._id, 'adminDecision.action': { $in: ['WARN', 'HIDE_CONTENT', 'SUSPEND_USER'] } })
    .sort({ updatedAt: -1 }).select('-reporter');
  ok(res, items);
});

exports.appeal = asyncHandler(async (req, res) => ok(res, await service.appeal(req.user, req.params.id, req.body.message)));
