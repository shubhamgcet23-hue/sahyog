const mongoose = require('mongoose');

const { Schema } = mongoose;

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED'];

const requestSchema = new Schema(
  {
    resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestType: { type: String, enum: ['BORROW', 'DONATE', 'SHARE'], required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    message: { type: String, trim: true, maxlength: 1000 },
    intendedUse: { type: String, enum: ['PERSONAL', 'EDUCATION', 'HEALTHCARE', 'COMMUNITY_EVENT', 'OTHER'], default: 'PERSONAL' },
    handoverMethod: { type: String, enum: ['PICKUP', 'DELIVERY'], default: 'PICKUP' },
    handoverNote: { type: String, trim: true, maxlength: 300 },
    proposedReturnDate: Date,
    status: { type: String, enum: STATUSES, default: 'PENDING', index: true },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: STATUSES },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    // Snapshot so history & impact stats survive listing edits/deletion.
    resourceSnapshot: {
      title: String,
      category: String,
      availabilityType: String,
      image: String,
    },
    approvedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledBy: { type: String, enum: ['owner', 'requester'] },
    reminderSentAt: Date,
    overdueNotifiedAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

requestSchema.index({ requester: 1, createdAt: -1 });
requestSchema.index({ owner: 1, status: 1, createdAt: -1 });
requestSchema.index({ resource: 1, status: 1 });
requestSchema.index({ status: 1, proposedReturnDate: 1 });
requestSchema.index({ status: 1, completedAt: 1 });

/** Overdue flag: a borrow whose return date has passed without completion. */
requestSchema.virtual('isOverdue').get(function isOverdue() {
  return (
    this.requestType === 'BORROW' &&
    ['APPROVED', 'IN_PROGRESS'].includes(this.status) &&
    Boolean(this.proposedReturnDate) &&
    this.proposedReturnDate.getTime() < Date.now()
  );
});

requestSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('ResourceRequest', requestSchema);
