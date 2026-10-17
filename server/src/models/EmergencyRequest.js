const mongoose = require('mongoose');
const { pointSchema, imageSchema } = require('./_shared');

const { Schema } = mongoose;

const STATUSES = ['OPEN', 'UNDER_REVIEW', 'MATCHED', 'FULFILLED', 'CLOSED'];

const responseSchema = new Schema(
  {
    responder: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offerType: { type: String, enum: ['DONATE', 'LEND', 'VOLUNTEER', 'INFO'], default: 'DONATE' },
    message: { type: String, trim: true, required: true, maxlength: 800 },
    quantity: { type: Number, min: 1 },
    status: { type: String, enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'], default: 'OFFERED' },
  },
  { timestamps: true }
);

const emergencySchema = new Schema(
  {
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 140 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    category: { type: String, required: true, index: true },
    urgency: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    urgencyRank: { type: Number, default: 2 }, // 0 = most urgent; keeps sorting correct in MongoDB
    quantity: { type: Number, min: 1 },
    needBy: Date,
    location: { type: pointSchema(true), required: true },
    areaLabel: { type: String, trim: true, maxlength: 120 },
    images: {
      type: [imageSchema],
      validate: { validator: (v) => v.length <= 5, message: 'At most 5 images' },
    },
    contactPreference: { type: String, enum: ['IN_APP_ONLY', 'SHARE_PHONE_AFTER_MATCH'], default: 'IN_APP_ONLY' },
    status: { type: String, enum: STATUSES, default: 'OPEN', index: true },
    statusHistory: [
      { _id: false, status: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, note: String, at: { type: Date, default: Date.now } },
    ],
    responses: [responseSchema],
    moderationNote: String,
    fulfilledAt: Date,
  },
  { timestamps: true }
);

const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
emergencySchema.pre('validate', function setRank(next) {
  this.urgencyRank = RANK[this.urgency] ?? 2;
  next();
});

emergencySchema.index({ location: '2dsphere' });
emergencySchema.index({ status: 1, urgencyRank: 1, createdAt: -1 });
emergencySchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('EmergencyRequest', emergencySchema);
