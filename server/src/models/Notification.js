const mongoose = require('mongoose');

const { Schema } = mongoose;

const TYPES = [
  'REQUEST_NEW', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_CANCELLED', 'REQUEST_IN_PROGRESS',
  'REQUEST_COMPLETED', 'MESSAGE_NEW', 'RETURN_REMINDER', 'RETURN_OVERDUE', 'REVIEW_RECEIVED',
  'EMERGENCY_RESPONSE', 'EMERGENCY_UPDATE', 'ORG_VERIFICATION', 'MODERATION', 'SYSTEM',
];

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true, maxlength: 140 },
    message: { type: String, maxlength: 500 },
    relatedResource: { type: Schema.Types.ObjectId, ref: 'Resource' },
    relatedRequest: { type: Schema.Types.ObjectId, ref: 'ResourceRequest' },
    relatedEmergency: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest' },
    relatedConversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    link: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
