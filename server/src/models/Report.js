const mongoose = require('mongoose');

const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['USER', 'RESOURCE', 'REVIEW', 'EMERGENCY'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // the account responsible for the content
    reason: { type: String, enum: ['SPAM', 'FRAUD', 'ABUSIVE', 'UNSAFE', 'INAPPROPRIATE', 'OTHER'], required: true },
    description: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'], default: 'PENDING', index: true },
    adminDecision: {
      action: { type: String, enum: ['NONE', 'WARN', 'HIDE_CONTENT', 'SUSPEND_USER'], default: 'NONE' },
      note: String,
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      decidedAt: Date,
    },
    // A reported user can challenge the decision once; an admin then upholds or overturns it.
    appeal: {
      status: { type: String, enum: ['NONE', 'PENDING', 'UPHELD', 'OVERTURNED'], default: 'NONE' },
      message: { type: String, maxlength: 1000 },
      createdAt: Date,
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      decidedAt: Date,
      note: String,
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
