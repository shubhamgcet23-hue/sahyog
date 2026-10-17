const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/** Record an important administrative action. Never throws - audit failures must not break the request. */
async function audit(req, action, targetType, targetId, details) {
  try {
    await AuditLog.create({ admin: req.user._id, action, targetType, targetId, details, ip: req.ip });
  } catch (err) {
    logger.error('Audit log failed', { action, message: err.message });
  }
}
module.exports = audit;
