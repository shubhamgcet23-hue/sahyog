const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const COOKIE_NAME = 'sahyog_token';

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return { token: header.slice(7), source: 'header' };
  if (req.cookies && req.cookies[COOKIE_NAME]) return { token: req.cookies[COOKIE_NAME], source: 'cookie' };
  return { token: null };
}

async function resolveUser(req, { allowSuspended = false, optional = false } = {}) {
  const { token, source } = extractToken(req);
  if (!token) {
    if (optional) return null;
    throw new ApiError(401, 'Authentication required');
  }
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    if (optional) return null;
    throw new ApiError(401, 'Your session is invalid or has expired. Please log in again.');
  }
  if (payload.purpose) { // e.g. short-lived socket tokens are not valid API credentials
    if (optional) return null;
    throw new ApiError(401, 'Invalid credentials');
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    if (optional) return null;
    throw new ApiError(401, 'Account no longer exists');
  }
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) { // password was changed/reset after this token was issued
    if (optional) return null;
    throw new ApiError(401, 'Your session is no longer valid. Please log in again.');
  }
  if (user.accountStatus !== 'ACTIVE' && !allowSuspended) {
    if (optional) return null;
    throw new ApiError(403, 'Your account is suspended. You can review and appeal moderation decisions from your account page.');
  }
  req.tokenSource = source;
  return user;
}

const protect = asyncHandler(async (req, _res, next) => {
  req.user = await resolveUser(req);
  next();
});

/** For the few endpoints a suspended user may still use (view decision, appeal). */
const protectAllowSuspended = asyncHandler(async (req, _res, next) => {
  req.user = await resolveUser(req, { allowSuspended: true });
  next();
});

const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await resolveUser(req, { optional: true });
  next();
});

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  return next();
};

/**
 * CSRF defence for cookie-authenticated, state-changing requests: browsers cannot attach a custom
 * header cross-origin without a CORS preflight, which our CORS policy only grants to CLIENT_URL.
 */
const csrfGuard = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const usesCookie = req.cookies && req.cookies[COOKIE_NAME] && !(req.headers.authorization || '').startsWith('Bearer ');
  if (usesCookie && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return next(new ApiError(403, 'Missing X-Requested-With header'));
  }
  return next();
};

module.exports = { protect, protectAllowSuspended, optionalAuth, authorize, csrfGuard, extractToken, COOKIE_NAME };
