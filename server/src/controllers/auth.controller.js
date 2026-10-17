const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const tokens = require('../services/tokenService');
const { sendEmail } = require('../services/emailService');
const { env } = require('../config/env');

const startSession = (res, user) => {
  tokens.setAuthCookie(res, tokens.signToken(user));
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, organizationDetails } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  const verifyToken = tokens.randomToken();
  const user = await User.create({
    name, email, phone, role,
    passwordHash: await User.hashPassword(password),
    ...(role === 'ORGANIZATION' ? { organizationDetails: { ...organizationDetails, verificationStatus: 'NONE' } } : {}),
    emailVerifyTokenHash: tokens.hashToken(verifyToken),
  });
  sendEmail({ to: email, subject: 'Verify your Sahyog email', text: `Welcome to Sahyog! Verify your email: ${env.CLIENT_URL}/verify-email?token=${verifyToken}` });
  startSession(res, user);
  created(res, { user });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // same message for unknown email / wrong password: do not reveal which accounts exist
  if (!user || !(await user.comparePassword(req.body.password))) throw new ApiError(401, 'Invalid email or password');
  user.lastLoginAt = new Date();
  await user.save();
  startSession(res, user);
  ok(res, { user });
});

exports.logout = (_req, res) => {
  tokens.clearAuthCookie(res);
  ok(res, { message: 'Logged out' });
};

/** Sign out everywhere: bumping tokenVersion invalidates every JWT issued so far (including this device's). */
exports.logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  tokens.clearAuthCookie(res);
  ok(res, { message: 'Signed out of all devices' });
});

exports.me = (req, res) => ok(res, { user: req.user });

exports.socketToken = (req, res) => ok(res, { token: tokens.signSocketToken(req.user) });

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  if (req.body.currentPassword === req.body.newPassword) throw new ApiError(400, 'New password must be different');
  user.passwordHash = await User.hashPassword(req.body.newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // signs out every other session
  await user.save();
  startSession(res, user);
  ok(res, { message: 'Password updated' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.accountStatus === 'ACTIVE') {
    const token = tokens.randomToken();
    user.passwordResetTokenHash = tokens.hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    sendEmail({ to: user.email, subject: 'Reset your Sahyog password', text: `Reset your password (valid for 30 minutes): ${env.CLIENT_URL}/reset-password?token=${token}` });
  }
  // identical response either way (no account enumeration)
  ok(res, { message: 'If that email is registered, a reset link has been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ passwordResetTokenHash: tokens.hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired');
  user.passwordHash = await User.hashPassword(req.body.password);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  ok(res, { message: 'Password reset. You can now log in.' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    { emailVerifyTokenHash: tokens.hashToken(req.body.token) },
    { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: 1 } },
    { new: true }
  );
  if (!user) throw new ApiError(400, 'This verification link is invalid or already used');
  ok(res, { message: 'Email verified' });
});
