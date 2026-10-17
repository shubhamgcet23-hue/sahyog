const mongoose = require('mongoose');

const { Schema } = mongoose;

const verificationSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, trim: true, maxlength: 1000 },
    documents: [{ _id: false, url: String, publicId: String, name: String }],
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrgVerification', verificationSchema);
