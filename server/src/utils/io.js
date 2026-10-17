/** Holds the Socket.IO server so services can emit events without circular imports. */
let io = null;
module.exports = {
  setIO: (instance) => { io = instance; },
  getIO: () => io,
  emitToUser: (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); },
  emitToConversation: (convId, event, payload) => { if (io) io.to(`conv:${convId}`).emit(event, payload); },
};
