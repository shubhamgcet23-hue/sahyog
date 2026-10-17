const mongoose = require('mongoose');
const { Conversation, Message } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const service = require('../services/conversationService');

exports.list = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const convs = await Conversation.find({ participants: me })
    .sort({ lastMessageAt: -1 }).limit(100)
    .populate('participants', 'name profileImage role')
    .populate('relatedRequest', 'resourceSnapshot status')
    .populate('relatedEmergency', 'title status');
  const counts = await Message.aggregate([
    { $match: { conversation: { $in: convs.map((c) => c._id) }, sender: { $ne: me }, readBy: { $ne: me } } },
    { $group: { _id: '$conversation', n: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  ok(res, convs.map((c) => ({ ...c.toJSON(), unread: map[String(c._id)] || 0 })));
});

exports.open = asyncHandler(async (req, res) => created(res, await service.open(req.user, req.body)));

exports.messages = asyncHandler(async (req, res) => {
  const conv = await service.assertParticipant(req.params.id, req.user._id);
  const { before, limit } = req.validatedQuery;
  const filter = { conversation: conv._id, ...(before ? { createdAt: { $lt: before } } : {}) };
  const items = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
  ok(res, items.reverse(), { hasMore: items.length === limit });
});

exports.send = asyncHandler(async (req, res) => created(res, await service.sendMessage(req.user, req.params.id, req.body.content)));

exports.read = asyncHandler(async (req, res) => ok(res, { updated: await service.markRead(req.user, req.params.id) }));
