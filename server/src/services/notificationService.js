const { Notification } = require('../models');
const { emitToUser } = require('../utils/io');
const logger = require('../utils/logger');

/**
 * Create an in-app notification and push it over Socket.IO. Never throws: a failed
 * notification must not roll back the business action that triggered it.
 */
async function notify({ recipient, type, title, message, relatedResource, relatedRequest, relatedEmergency, relatedConversation, link }) {
  try {
    if (!recipient) return null;
    let doc;
    if (type === 'MESSAGE_NEW' && relatedConversation) {
      // collapse chat chatter into one unread notification per conversation
      doc = await Notification.findOneAndUpdate(
        { recipient, type, relatedConversation, isRead: false },
        { $set: { title, message, link, createdAt: new Date() } },
        { new: true }
      );
    }
    if (!doc) doc = await Notification.create({ recipient, type, title, message, relatedResource, relatedRequest, relatedEmergency, relatedConversation, link });
    emitToUser(recipient, 'notification:new', doc.toJSON());
    return doc;
  } catch (err) {
    logger.error('notify failed', { type, message: err.message });
    return null;
  }
}

module.exports = { notify };
