const { Report, Resource, Review, EmergencyRequest, User } = require('../models');
const ApiError = require('../utils/ApiError');
const trust = require('./trustService');
const rewards = require('./rewardService');
const inventory = require('./inventoryService');
const { notify } = require('./notificationService');

async function resolveTarget(targetType, targetId) {
  let target; let reportedUser;
  if (targetType === 'USER') { target = await User.findById(targetId); reportedUser = target?._id; }
  if (targetType === 'RESOURCE') { target = await Resource.findById(targetId); reportedUser = target?.owner; }
  if (targetType === 'REVIEW') { target = await Review.findById(targetId); reportedUser = target?.reviewer; }
  if (targetType === 'EMERGENCY') { target = await EmergencyRequest.findById(targetId); reportedUser = target?.creator; }
  if (!target) throw new ApiError(404, `${targetType.toLowerCase()} not found`);
  return { target, reportedUser };
}

async function create(user, data) {
  const { reportedUser } = await resolveTarget(data.targetType, data.targetId);
  if (String(reportedUser) === String(user._id)) throw new ApiError(400, 'You cannot report your own content');
  try {
    const report = await Report.create({ reporter: user._id, targetType: data.targetType, targetId: data.targetId, reportedUser, reason: data.reason, description: data.description });
    if (data.targetType === 'REVIEW') await Review.updateOne({ _id: data.targetId, moderationStatus: 'VISIBLE' }, { $set: { moderationStatus: 'FLAGGED' } });
    return report;
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already reported this');
    throw err;
  }
}

async function hideContent(report) {
  if (report.targetType === 'RESOURCE') await Resource.updateOne({ _id: report.targetId }, { $set: { status: 'HIDDEN', hiddenReason: 'Hidden by moderator' } });
  if (report.targetType === 'REVIEW') await Review.updateOne({ _id: report.targetId }, { $set: { moderationStatus: 'HIDDEN' } });
  if (report.targetType === 'EMERGENCY') await EmergencyRequest.updateOne({ _id: report.targetId }, { $set: { status: 'CLOSED', moderationNote: 'Closed by moderator' } });
}

async function restoreContent(report) {
  if (report.targetType === 'RESOURCE') {
    await Resource.updateOne({ _id: report.targetId, status: 'HIDDEN' }, { $set: { status: 'AVAILABLE' }, $unset: { hiddenReason: 1 } });
    await inventory.syncStatus(report.targetId);
  }
  if (report.targetType === 'REVIEW') await Review.updateOne({ _id: report.targetId }, { $set: { moderationStatus: 'VISIBLE' } });
  if (report.targetType === 'EMERGENCY') await EmergencyRequest.updateOne({ _id: report.targetId, status: 'CLOSED' }, { $set: { status: 'OPEN' } });
}

/** Admin decision on a report and/or its appeal. */
async function decide(admin, id, data) {
  const report = await Report.findById(id);
  if (!report) throw new ApiError(404, 'Report not found');
  const changes = [];

  if (data.appealDecision) {
    if (report.appeal.status !== 'PENDING') throw new ApiError(409, 'There is no pending appeal on this report');
    report.appeal.status = data.appealDecision;
    report.appeal.decidedBy = admin._id;
    report.appeal.decidedAt = new Date();
    report.appeal.note = data.note;
    if (data.appealDecision === 'OVERTURNED') {
      await restoreContent(report);
      if (report.adminDecision.action === 'SUSPEND_USER' && report.reportedUser) {
        await User.updateOne({ _id: report.reportedUser }, { $set: { accountStatus: 'ACTIVE' }, $unset: { suspensionReason: 1 } });
      }
      report.status = 'DISMISSED';
    }
    changes.push(`appeal ${data.appealDecision.toLowerCase()}`);
    await notify({ recipient: report.reportedUser, type: 'MODERATION', title: `Appeal ${data.appealDecision === 'OVERTURNED' ? 'accepted' : 'declined'}`, message: data.note || (data.appealDecision === 'OVERTURNED' ? 'The moderation decision was reversed.' : 'The original decision stands.'), link: '/settings' });
  } else {
    const action = data.action || 'NONE';
    if (action === 'SUSPEND_USER') {
      const target = await User.findById(report.reportedUser);
      if (!target) throw new ApiError(404, 'Reported user not found');
      if (target.role === 'ADMIN') throw new ApiError(400, 'Administrators cannot be suspended');
      await User.updateOne({ _id: target._id }, { $set: { accountStatus: 'SUSPENDED', suspensionReason: data.note || 'Policy violation' } });
    }
    if (action === 'HIDE_CONTENT' || action === 'SUSPEND_USER') await hideContent(report);
    if (data.reverseRewards && report.targetType !== 'USER') {
      // reward ledger is exchange based: only reverse when the admin explicitly asks
      const { ResourceRequest } = require('../models');
      const requests = await ResourceRequest.find({ resource: report.targetId, status: 'COMPLETED' }).select('_id');
      for (const r of requests) await rewards.reverseForExchange(r._id, 'Reversed after confirmed policy violation');
    }
    report.adminDecision = { action, note: data.note, decidedBy: admin._id, decidedAt: new Date() };
    report.status = data.status || (action === 'NONE' ? 'DISMISSED' : 'RESOLVED');
    changes.push(`${report.status.toLowerCase()} (${action.toLowerCase()})`);
    if (action !== 'NONE') {
      await notify({
        recipient: report.reportedUser, type: 'MODERATION', title: 'A moderation decision was made',
        message: `${data.note || 'Content or conduct you are responsible for was reviewed.'} If you believe this is a mistake you can appeal from your account page.`, link: '/settings',
      });
    }
  }
  await report.save();
  if (report.reportedUser) await trust.recompute(report.reportedUser);
  return { report, summary: changes.join(', ') };
}

async function appeal(user, id, message) {
  const report = await Report.findById(id);
  if (!report || String(report.reportedUser) !== String(user._id)) throw new ApiError(404, 'Report not found');
  if (!['HIDE_CONTENT', 'SUSPEND_USER', 'WARN'].includes(report.adminDecision.action)) throw new ApiError(409, 'Only actions taken against you can be appealed');
  if (report.appeal.status !== 'NONE') throw new ApiError(409, 'This decision has already been appealed');
  report.appeal = { status: 'PENDING', message, createdAt: new Date() };
  await report.save();
  return report;
}

module.exports = { create, decide, appeal };
