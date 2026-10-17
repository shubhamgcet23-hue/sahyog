const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { pointSchema, imageSchema } = require('./_shared');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 20 },
    bio: { type: String, trim: true, maxlength: 500 },
    profileImage: imageSchema,
    role: { type: String, enum: ['USER', 'ORGANIZATION', 'ADMIN'], default: 'USER', index: true },
    accountStatus: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    suspensionReason: String,
    organizationDetails: {
      orgName: { type: String, trim: true, maxlength: 120 },
      orgType: { type: String, enum: ['HOSPITAL', 'SCHOOL', 'NGO', 'COMMUNITY', 'OTHER'] },
      registrationNumber: { type: String, trim: true, maxlength: 60 },
      website: { type: String, trim: true, maxlength: 200 },
      description: { type: String, trim: true, maxlength: 1000 },
      verificationStatus: { type: String, enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], default: 'NONE' },
      verifiedAt: Date,
      verificationNote: String,
    },
    location: {
      type: pointSchema(false),
      default: undefined,
    },
    areaLabel: { type: String, trim: true, maxlength: 120 },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    rewardPoints: { type: Number, default: 0, min: 0 },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: Date,
    tokenVersion: { type: Number, default: 0 }, // bump to revoke every existing session (password change/reset)
  },
  { timestamps: true }
);

userSchema.index({ 'organizationDetails.verificationStatus': 1 });
userSchema.index({ name: 'text', email: 'text' });

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, Number(process.env.BCRYPT_ROUNDS) || 12);

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isVerifiedOrg = function isVerifiedOrg() {
  return this.role === 'ORGANIZATION' && this.organizationDetails?.verificationStatus === 'VERIFIED';
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.emailVerifyTokenHash;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
