const mongoose = require('mongoose');

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    request: { type: Schema.Types.ObjectId, ref: 'ResourceRequest', required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, trim: true, maxlength: 1000 },
    moderationStatus: { type: String, enum: ['VISIBLE', 'FLAGGED', 'HIDDEN'], default: 'VISIBLE' },
  },
  { timestamps: true }
);

reviewSchema.index({ request: 1, reviewer: 1 }, { unique: true }); // one review per participant per exchange
reviewSchema.index({ reviewee: 1, moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
