const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, message },
  });

module.exports = {
  apiLimiter: make(15 * 60 * 1000, 600, 'Too many requests, please slow down.'),
  authLimiter: make(15 * 60 * 1000, 20, 'Too many attempts. Please try again in a few minutes.'),
  sensitiveLimiter: make(60 * 60 * 1000, 30, 'Too many requests of this kind. Please try again later.'),
};
