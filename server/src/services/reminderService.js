const { ResourceRequest } = require('../models');
const { notify } = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Hourly job: remind both parties 48h before a return date and flag overdue borrows.
 * reminderSentAt / overdueNotifiedAt make it idempotent.
 */
async function run(now = new Date()) {
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const active = { requestType: 'BORROW', status: { $in: ['APPROVED', 'IN_PROGRESS'] } };

  const upcoming = await ResourceRequest.find({ ...active, proposedReturnDate: { $gt: now, $lte: soon }, reminderSentAt: { $exists: false } });
  for (const r of upcoming) {
    const when = r.proposedReturnDate.toDateString();
    await Promise.all([
      notify({ recipient: r.requester, type: 'RETURN_REMINDER', title: 'Return due soon', message: `"${r.resourceSnapshot?.title}" is due back on ${when}.`, relatedRequest: r._id, link: `/requests/${r._id}` }),
      notify({ recipient: r.owner, type: 'RETURN_REMINDER', title: 'Return due soon', message: `"${r.resourceSnapshot?.title}" is due back on ${when}.`, relatedRequest: r._id, link: `/requests/${r._id}` }),
    ]);
    await ResourceRequest.updateOne({ _id: r._id }, { $set: { reminderSentAt: now } });
  }

  const overdue = await ResourceRequest.find({ ...active, proposedReturnDate: { $lt: now }, overdueNotifiedAt: { $exists: false } });
  for (const r of overdue) {
    await Promise.all([
      notify({ recipient: r.requester, type: 'RETURN_OVERDUE', title: 'Return overdue', message: `"${r.resourceSnapshot?.title}" was due on ${r.proposedReturnDate.toDateString()}. Please arrange the return.`, relatedRequest: r._id, link: `/requests/${r._id}` }),
      notify({ recipient: r.owner, type: 'RETURN_OVERDUE', title: 'Return overdue', message: `"${r.resourceSnapshot?.title}" has not been returned yet.`, relatedRequest: r._id, link: `/requests/${r._id}` }),
    ]);
    await ResourceRequest.updateOne({ _id: r._id }, { $set: { overdueNotifiedAt: now } });
  }
  if (upcoming.length || overdue.length) logger.info('Reminder job', { reminders: upcoming.length, overdue: overdue.length });
  return { reminders: upcoming.length, overdue: overdue.length };
}

function start(intervalMs = 60 * 60 * 1000) {
  const timer = setInterval(() => run().catch((e) => logger.error('Reminder job failed', { message: e.message })), intervalMs);
  timer.unref();
  run().catch(() => {});
  return timer;
}

module.exports = { run, start };
