const mongoose = require('mongoose');

const { Schema } = mongoose;

/** Append-only ledger. EARNED rows are positive, REVERSED rows negative. dedupeKey makes awards idempotent. */
const rewardSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    kind: { type: String, enum: ['EARNED', 'REVERSED'], default: 'EARNED' },
    transactionType: {
      type: String,
      enum: ['DONATION_COMPLETED', 'SHARE_COMPLETED', 'BORROW_COMPLETED', 'BORROW_RETURNED', 'COMMUNITY_NEED_FULFILLED', 'REVERSAL'],
      required: true,
    },
    relatedExchange: { type: Schema.Types.ObjectId, ref: 'ResourceRequest' },
    relatedEmergency: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest' },
    reverses: { type: Schema.Types.ObjectId, ref: 'RewardTransaction' },
    description: String,
    dedupeKey: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

rewardSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('RewardTransaction', rewardSchema);
