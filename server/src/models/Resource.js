const mongoose = require('mongoose');
const { pointSchema, imageSchema } = require('./_shared');

const { Schema } = mongoose;

const resourceSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    category: { type: String, required: true, index: true }, // Category.slug
    subcategory: { type: String, trim: true, maxlength: 60 },
    condition: { type: String, enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'], required: true },
    images: {
      type: [imageSchema],
      validate: { validator: (v) => v.length <= 5, message: 'A listing can have at most 5 images' },
    },
    availabilityType: { type: String, enum: ['BORROW', 'DONATE', 'SHARE'], required: true, index: true },
    quantity: { type: Number, required: true, min: 1, max: 10000, validate: Number.isInteger },
    availableQuantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    location: { type: pointSchema(true), required: true },
    areaLabel: { type: String, trim: true, maxlength: 120 },
    // Private pickup details: only the owner and approved requesters ever see this.
    addressDetail: { type: String, trim: true, maxlength: 300, select: false },
    availabilityDates: { from: Date, to: Date },
    status: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE', 'HIDDEN'], default: 'AVAILABLE', index: true },
    hiddenReason: String,
  },
  { timestamps: true }
);

resourceSchema.index({ location: '2dsphere' });
resourceSchema.index({ status: 1, createdAt: -1 });
resourceSchema.index({ category: 1, availabilityType: 1, status: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
