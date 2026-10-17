const mongoose = require('mongoose');
const { Conversation, Message, ResourceRequest, EmergencyRequest } = require('../models');
const ApiError = require('../utils/ApiError');
const { emitToUser, emitToConversation } = require('../utils/io');
const { notify } = require('./notificationService');

const sortedKey = (a, b) => [String(a), String(b)].sort().join(':');

async function ensureForRequest(request) {
  const key = `req:${request._id}`;
  let conv = await Conversation.findOne({ key });
  if (!conv) {
    try {
      conv = await Conversation.create({ key, participants: [request.requester, request.owner], relatedRequest: request._id });
    } catch (err) {
      if (err.code !== 11000) throw err;
      conv = await Conversation.findOne({ key });
    }
  }
  return conv;
}

async function ensureForEmergency(emergency, otherUserId) {
  const key = `em:${emergency._id}:${sortedKey(emergency.creator, otherUserId)}`;
  let conv = await Conversation.findOne({ key });
  if (!conv) {
    try {
      conv = await Conversation.create({ key, participants: [emergency.creator, otherUserId], relatedEmergency: emergency._id });
    } catch (err) {
      if (err.code !== 11000) throw err;
      conv = await Conversation.findOne({ key });
    }
  }
  return conv;
}

/** Open (or return) a conversation the caller is legitimately part of. */
async function open(user, { requestId, emergencyId, withUser }) {
  if (requestId) {
    const request = await ResourceRequest.findById(requestId);
    if (!request) throw new ApiError(404, 'Request not found');
    if (![String(request.requester), String(request.owner)].includes(String(user._id))) throw new ApiError(403, 'You are not part of this request');
    return ensureForRequest(request);
  }
  const em = await EmergencyRequest.findById(emergencyId);
  if (!em) throw new ApiError(404, 'Emergency request not found');
  const isCreator = String(em.creator) === String(user._id);
  const other = isCreator ? withUser : user._id;
  if (!other) throw new ApiError(400, 'withUser is required for the creator');
  if (isCreator && !em.responses.some((r) => String(r.responder) === String(other))) throw new ApiError(403, 'That user has not responded to your request');
  if (!isCreator && !em.responses.some((r) => String(r.responder) === String(user._id))) throw new ApiError(403, 'Respond to this request before starting a conversation');
  return ensureForEmergency(em, other);
}

async function assertParticipant(conversationId, userId) {
  if (!mongoose.isValidObjectId(conversationId)) throw new ApiError(400, 'Invalid conversation id');
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  if (!conv.participants.some((p) => String(p) === String(userId))) throw new ApiError(403, 'You are not part of this conversation');
  return conv;
}

async function sendMessage(user, conversationId, content) {
  const conv = await assertParticipant(conversationId, user._id);
  const text = String(content || '').trim();
  if (!text) throw new ApiError(400, 'Message cannot be empty');
  if (text.length > 2000) throw new ApiError(400, 'Message is too long (max 2000 characters)');
  const msg = await Message.create({ conversation: conv._id, sender: user._id, content: text, readBy: [user._id] });
  conv.lastMessage = { content: text.slice(0, 200), sender: user._id };
  conv.lastMessageAt = msg.createdAt;
  await conv.save();

  const payload = msg.toJSON();
  emitToConversation(conv._id, 'message:new', payload);
  const other = conv.participants.find((p) => String(p) !== String(user._id));
  emitToUser(other, 'conversation:updated', { conversationId: conv._id, lastMessage: conv.lastMessage, lastMessageAt: conv.lastMessageAt });
  await notify({
    recipient: other, type: 'MESSAGE_NEW', title: `New message from ${user.name}`, message: text.slice(0, 120),
    relatedRequest: conv.relatedRequest, relatedEmergency: conv.relatedEmergency, relatedConversation: conv._id, link: `/messages/${conv._id}`,
  });
  return payload;
}

async function markRead(user, conversationId) {
  const conv = await assertParticipant(conversationId, user._id);
  const res = await Message.updateMany({ conversation: conv._id, readBy: { $ne: user._id } }, { $addToSet: { readBy: user._id } });
  emitToConversation(conv._id, 'message:read', { conversationId: conv._id, userId: user._id });
  return res.modifiedCount;
}

module.exports = { ensureForRequest, ensureForEmergency, open, assertParticipant, sendMessage, markRead };
