const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const p = parsePagination(req.validatedQuery, { defaultLimit: 20 });
  const filter = { recipient: req.user._id, ...(req.validatedQuery.unread === 'true' ? { isRead: false } : {}) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  ok(res, items, { ...pageMeta(p, total), unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { isRead: true } }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found');
  ok(res, n);
});

exports.readAll = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
  ok(res, { updated: r.modifiedCount });
});
