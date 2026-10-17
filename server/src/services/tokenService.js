const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');
const { COOKIE_NAME } = require('../middleware/auth');

const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion || 0 }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

/** Short-lived token for Socket.IO when the browser cannot send the API cookie (cross-site deployments). */
const signSocketToken = (user) => jwt.sign({ sub: String(user._id), purpose: 'socket', tv: user.tokenVersion || 0 }, env.JWT_SECRET, { expiresIn: '5m' });

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

const setAuthCookie = (res, token) => res.cookie(COOKIE_NAME, token, cookieOptions());
const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });

const randomToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

module.exports = { signToken, signSocketToken, setAuthCookie, clearAuthCookie, randomToken, hashToken };
