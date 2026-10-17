const mongoose = require('mongoose');

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: { validator: (v) => v.length === 2, message: 'A conversation has exactly two participants' },
      index: true,
    },
    relatedRequest: { type: Schema.Types.ObjectId, ref: 'ResourceRequest' },
    relatedEmergency: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest' },
    // Deduplication key: "req:<id>" or "em:<id>:<userA>:<userB>" (ids sorted)
    key: { type: String, required: true, unique: true },
    lastMessage: { content: String, sender: { type: Schema.Types.ObjectId, ref: 'User' } },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
