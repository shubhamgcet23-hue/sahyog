const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { env } = require('../config/env');
const { User } = require('../models');
const { COOKIE_NAME } = require('../middleware/auth');
const conversations = require('../services/conversationService');
const { setIO } = require('../utils/io');
const logger = require('../utils/logger');

/**
 * Socket.IO layer. Authentication happens in the handshake (API cookie, API bearer token or the
 * short-lived socket token) and every room join is authorised against the database.
 */
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URLS, credentials: true },
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const fromCookie = cookie.parse(socket.handshake.headers.cookie || '')[COOKIE_NAME];
      const token = socket.handshake.auth?.token || fromCookie;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('name role accountStatus tokenVersion');
      if (!user || user.accountStatus !== 'ACTIVE' || (payload.tv || 0) !== (user.tokenVersion || 0)) return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    socket.join(`user:${user._id}`); // private room for notifications; only the server emits into it

    // Join a conversation room only if the user is a participant (prevents room hijacking)
    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        const conv = await conversations.assertParticipant(conversationId, user._id);
        socket.join(`conv:${conv._id}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('conversation:leave', (conversationId) => socket.leave(`conv:${conversationId}`));

    socket.on('message:send', async ({ conversationId, content } = {}, ack) => {
      try {
        const message = await conversations.sendMessage(user, conversationId, content);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('message:read', async ({ conversationId } = {}, ack) => {
      try {
        await conversations.markRead(user, conversationId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('typing', async ({ conversationId, typing } = {}) => {
      try {
        await conversations.assertParticipant(conversationId, user._id);
        socket.to(`conv:${conversationId}`).emit('typing', { conversationId, userId: user._id, typing: Boolean(typing) });
      } catch (_) { /* ignore */ }
    });
  });

  setIO(io);
  logger.info('Socket.IO ready');
  return io;
}

module.exports = { initSockets };
