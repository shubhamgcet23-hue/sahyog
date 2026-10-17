const { Resource, ResourceRequest, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { canRequestTransition, ACTIVE_REQUEST_STATUSES } = require('../utils/stateMachine');
const inventory = require('./inventoryService');
const conversations = require('./conversationService');
const rewards = require('./rewardService');
const trust = require('./trustService');
const { notify } = require('./notificationService');
const { limits } = require('../config/scoring');

const isParty = (r, user) => [String(r.requester), String(r.owner)].includes(String(user._id));

async function create(user, data) {
  if (user.role === 'ADMIN') throw new ApiError(403, 'Administrators cannot create requests');
  const resource = await Resource.findById(data.resourceId);
  if (!resource || resource.status === 'HIDDEN') throw new ApiError(404, 'Resource not found');
  if (String(resource.owner) === String(user._id)) throw new ApiError(400, 'You cannot request your own resource');
  if (resource.status !== 'AVAILABLE' || resource.availableQuantity < 1) throw new ApiError(409, 'This resource is currently unavailable');
  if (data.quantity > resource.availableQuantity) throw new ApiError(400, `Only ${resource.availableQuantity} available - you requested ${data.quantity}`);

  const to = resource.availabilityDates?.to;
  if (to && to.getTime() < Date.now()) throw new ApiError(409, 'The availability window for this resource has ended');

  let returnDate;
  if (resource.availabilityType === 'BORROW') {
    if (!data.proposedReturnDate) throw new ApiError(400, 'proposedReturnDate: a return date is required when borrowing');
    returnDate = data.proposedReturnDate;
    const now = Date.now();
    if (returnDate.getTime() <= now) throw new ApiError(400, 'proposedReturnDate: return date must be in the future');
    if (returnDate.getTime() > now + limits.maxBorrowDays * 86400000) throw new ApiError(400, `proposedReturnDate: maximum borrowing period is ${limits.maxBorrowDays} days`);
  }

  const duplicate = await ResourceRequest.exists({ resource: resource._id, requester: user._id, status: { $in: ACTIVE_REQUEST_STATUSES } });
  if (duplicate) throw new ApiError(409, 'You already have an active request for this resource');

  const request = await ResourceRequest.create({
    resource: resource._id,
    requester: user._id,
    owner: resource.owner,
    requestType: resource.availabilityType,
    quantity: data.quantity,
    message: data.message,
    intendedUse: data.intendedUse,
    handoverMethod: data.handoverMethod,
    handoverNote: data.handoverNote,
    proposedReturnDate: returnDate,
    resourceSnapshot: { title: resource.title, category: resource.category, availabilityType: resource.availabilityType, image: resource.images?.[0]?.url },
    statusHistory: [{ status: 'PENDING', by: user._id, note: 'Request submitted' }],
  });
  await conversations.ensureForRequest(request);
  await notify({
    recipient: resource.owner, type: 'REQUEST_NEW', title: `New ${resource.availabilityType.toLowerCase()} request`,
    message: `${user.name} requested ${data.quantity} x "${resource.title}"`, relatedResource: resource._id, relatedRequest: request._id, link: `/requests/${request._id}`,
  });
  return request;
}

const NOTIFY_ON = {
  APPROVED: ['REQUEST_APPROVED', 'Request approved'],
  REJECTED: ['REQUEST_REJECTED', 'Request declined'],
  CANCELLED: ['REQUEST_CANCELLED', 'Request cancelled'],
  IN_PROGRESS: ['REQUEST_IN_PROGRESS', 'Handover started'],
  COMPLETED: ['REQUEST_COMPLETED', 'Exchange completed'],
};

const REWARD_TYPE = { DONATE: 'DONATION_COMPLETED', SHARE: 'SHARE_COMPLETED', BORROW: 'BORROW_COMPLETED' };

/**
 * Move a request to a new status.
 * - the legal transition + actor are checked against the state machine;
 * - the status change is a compare-and-set (`status: from` in the filter) so concurrent calls cannot both win;
 * - stock is reserved atomically on approval and released/consumed exactly once afterwards.
 */
async function transition(user, requestId, to, note) {
  const request = await ResourceRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'Request not found');
  if (!isParty(request, user)) throw new ApiError(403, 'You are not part of this request');

  const actor = String(request.owner) === String(user._id) ? 'owner' : 'requester';
  const from = request.status;
  if (to === 'APPROVED' && actor !== 'owner') throw new ApiError(403, 'Only the resource owner can approve a request');
  if (!canRequestTransition(from, to, actor)) {
    throw new ApiError(409, `Cannot change a ${from} request to ${to}${actor === 'requester' && to !== 'CANCELLED' ? ' as the requester' : ''}`);
  }

  let reserved = false;
  if (to === 'APPROVED') {
    const res = await inventory.reserve(request.resource, request.quantity);
    if (!res) throw new ApiError(409, 'Not enough stock to approve this request');
    reserved = true;
  }

  const set = { status: to };
  if (to === 'APPROVED') set.approvedAt = new Date();
  if (to === 'IN_PROGRESS') set.startedAt = new Date();
  if (to === 'COMPLETED') set.completedAt = new Date();
  if (to === 'CANCELLED') set.cancelledBy = actor;

  const updated = await ResourceRequest.findOneAndUpdate(
    { _id: request._id, status: from },
    { $set: set, $push: { statusHistory: { status: to, by: user._id, note, at: new Date() } } },
    { new: true }
  );
  if (!updated) {
    if (reserved) await inventory.release(request.resource, request.quantity);
    throw new ApiError(409, 'This request was just updated by someone else. Refresh and try again.');
  }

  // side effects run once, only for the winner of the compare-and-set
  if (['APPROVED', 'IN_PROGRESS'].includes(from) && to === 'CANCELLED') await inventory.release(request.resource, request.quantity);
  if (to === 'COMPLETED') {
    if (updated.requestType === 'DONATE') await inventory.consumeDonation(request.resource, request.quantity);
    else await inventory.release(request.resource, request.quantity); // borrowed/shared item is back in the pool
    await rewards.award({ userId: updated.owner, type: REWARD_TYPE[updated.requestType], requestId: updated._id, description: `Completed ${updated.requestType.toLowerCase()}: ${updated.resourceSnapshot?.title}` });
    if (updated.requestType === 'BORROW') {
      await rewards.award({ userId: updated.requester, type: 'BORROW_RETURNED', requestId: updated._id, description: `Returned: ${updated.resourceSnapshot?.title}` });
    }
  }
  if (to === 'COMPLETED' || (to === 'CANCELLED' && updated.approvedAt)) {
    await Promise.all([trust.recompute(updated.owner), trust.recompute(updated.requester)]);
  }

  const [type, title] = NOTIFY_ON[to];
  const recipient = actor === 'owner' ? updated.requester : updated.owner;
  const tail = to === 'COMPLETED' ? ' You can now leave a review.' : '';
  await notify({
    recipient, type, title, message: `"${updated.resourceSnapshot?.title}" - ${actor === 'owner' ? 'the owner' : 'the requester'} updated the request.${note ? ` Note: ${note}` : ''}${tail}`,
    relatedResource: updated.resource, relatedRequest: updated._id, link: `/requests/${updated._id}`,
  });
  if (to === 'COMPLETED') {
    await notify({ recipient: updated.owner, type: 'REQUEST_COMPLETED', title: 'Exchange completed', message: `You completed "${updated.resourceSnapshot?.title}". Rate the other person to build trust.`, relatedRequest: updated._id, link: `/requests/${updated._id}` });
  }
  return updated;
}

async function listFor(user, role, q, { skip, limit }) {
  const filter = role === 'owner' ? { owner: user._id } : { requester: user._id };
  if (q.status) filter.status = q.status;
  if (q.type) filter.requestType = q.type;
  if (q.overdue === 'true') {
    Object.assign(filter, { requestType: 'BORROW', status: { $in: ['APPROVED', 'IN_PROGRESS'] }, proposedReturnDate: { $lt: new Date() } });
  }
  const populate = role === 'owner' ? { path: 'requester', select: 'name trustScore profileImage role' } : { path: 'owner', select: 'name trustScore profileImage role' };
  const [items, total] = await Promise.all([
    ResourceRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populate),
    ResourceRequest.countDocuments(filter),
  ]);
  return { items, total };
}

async function getForParty(user, id) {
  const request = await ResourceRequest.findById(id)
    .populate('requester', 'name trustScore profileImage role organizationDetails.orgName')
    .populate('owner', 'name trustScore profileImage role organizationDetails.orgName');
  if (!request) throw new ApiError(404, 'Request not found');
  const uid = String(user._id);
  const party = [String(request.requester._id), String(request.owner._id)].includes(uid);
  if (!party && user.role !== 'ADMIN') throw new ApiError(403, 'You are not part of this request');
  return request;
}

module.exports = { create, transition, listFor, getForParty, isParty };
