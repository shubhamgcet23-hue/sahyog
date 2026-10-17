const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../utils/logger');

let transporter;
const getTransporter = () => {
  if (!env.emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    });
  }
  return transporter;
};

/** Optional email. Without EMAIL_* variables the message is only logged (handy in development). */
async function sendEmail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    logger.info('Email (not sent - EMAIL_* not configured)', { to, subject, text: env.isProd ? undefined : text });
    return false;
  }
  try {
    await t.sendMail({ from: `Sahyog <${env.EMAIL_USER}>`, to, subject, text });
    return true;
  } catch (err) {
    logger.error('Email failed', { to, message: err.message });
    return false;
  }
}

module.exports = { sendEmail };
