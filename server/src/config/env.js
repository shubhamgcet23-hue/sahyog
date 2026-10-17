const path = require('path');
// server/.env wins; the project-root .env (one level up) is the fallback. Real environment variables always win.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 5000;

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  PORT: port,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  SERVER_URL: (process.env.SERVER_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase(),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: Number(process.env.EMAIL_PORT) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
env.CLIENT_URL = env.CLIENT_URLS[0];
env.cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);
env.emailEnabled = Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD);

/** Fail fast on a bad configuration. Called once on startup. */
function validateEnv() {
  const problems = [];
  if (!env.MONGODB_URI) problems.push('MONGODB_URI is required');
  if (!env.JWT_SECRET) problems.push('JWT_SECRET is required');
  else if (env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (isProd && /replace-with|changeme|change-me|dev-only/i.test(env.JWT_SECRET || '')) problems.push('JWT_SECRET is still a placeholder - generate a random one for production');
  if (!['lax', 'strict', 'none'].includes(env.COOKIE_SAMESITE)) problems.push('COOKIE_SAMESITE must be lax, strict or none');
  if (env.COOKIE_SAMESITE === 'none' && !isProd) {
    // Browsers reject SameSite=None without Secure, and localhost http is not Secure.
    problems.push('COOKIE_SAMESITE=none requires HTTPS (use it in production only)');
  }
  if (problems.length) {
    const err = new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
    err.code = 'ENV_INVALID';
    throw err;
  }
}

module.exports = { env, validateEnv };
