const { EmergencyRequest, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { escapeRegex, approximatePoint, toPoint } = require('../utils/geo');
const { canEmergencyTransition } = require('../utils/stateMachine');
const { assertActiveCategory } = require('./categoryService');
const { saveImages, deleteImages } = require('./uploadService');
const { notify } = require('./notificationService');
const rewards = require('./rewardService');
const conversations = require('./conversationService');

const PUBLIC_STATUSES = ['OPEN', 'MATCHED', 'FULFILLED'];
const same = (a, b) => String(a) === String(b);

function canCreate(user) {
  if (user.role === 'USER') return true;
  if (user.role === 'ORGANIZATION') return user.isVerifiedOrg();
  return false;
}

async function create(user, data, files) {
  if (!canCreate(user)) {
    throw new ApiError(403, user.role === 'ORGANIZATION' ? 'Your organization must be verified before it can publish emergency requests' : 'Administrators cannot create emergency requests');
  }
  await assertActiveCategory(data.category);
  const images = await saveImages(files, 'emergencies');
  return EmergencyRequest.create({
    creator: user._id, title: data.title, description: data.description, category: data.category, urgency: data.urgency,
    quantity: data.quantity, needBy: data.needBy, location: toPoint(data.lat, data.lng), areaLabel: data.areaLabel,
    contactPreference: data.contactPreference, images, statusHistory: [{ status: 'OPEN', by: user._id, note: 'Created' }],
  });
}

async function list(user, q, { skip, limit, page }) {
  const filter = {};
  if (q.category) filter.category = q.category;
  if (q.urgency) filter.urgency = q.urgency;
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); filter.$or = [{ title: rx }, { description: rx }]; }

  if (q.mine === 'true') filter.creator = user._id;
  else if (q.responded === 'true') filter['responses.responder'] = user._id;
  else if (user.role === 'ADMIN') { if (q.status) filter.status = q.status; }
  else filter.status = q.status && PUBLIC_STATUSES.includes(q.status) ? q.status : { $in: PUBLIC_STATUSES };
  if ((q.mine === 'true' || q.responded === 'true') && q.status) filter.status = q.status;

  if (q.lat !== undefined && q.lng !== undefined) {
    filter.location = { $geoWithin: { $centerSphere: [[q.lng, q.lat], q.radiusKm / 6378.1] } };
  }
  const [docs, total] = await Promise.all([
    EmergencyRequest.find(filter).sort({ urgencyRank: 1, createdAt: -1 }).skip(skip).limit(limit).populate('creator', 'name role organizationDetails.orgName organizationDetails.verificationStatus'),
    EmergencyRequest.countDocuments(filter),
  ]);
  return { items: docs.map((d) => shape(d, user)), total, page };
}

/** Privacy-aware serialisation: approximate location, no contact data, responses scoped to the viewer. */
function shape(doc, viewer) {
  const o = doc.toJSON();
  const isCreator = viewer && same(doc.creator._id || doc.creator, viewer._id);
  const isAdmin = viewer?.role === 'ADMIN';
  o.location = approximatePoint(o.location, 2);
  o.responseCount = o.responses.length;
  if (!isCreator && !isAdmin) {
    o.responses = o.responses.filter((r) => viewer && same(r.responder._id || r.responder, viewer._id));
    delete o.moderationNote;
  }
  o.isCreator = Boolean(isCreator);
  return o;
}

async function getById(user, id) {
  const doc = await EmergencyRequest.findById(id)
    .populate('creator', 'name role phone organizationDetails.orgName organizationDetails.verificationStatus')
    .populate('responses.responder', 'name role trustScore organizationDetails.orgName');
  if (!doc) throw new ApiError(404, 'Emergency request not found');
  const isCreator = same(doc.creator._id, user._id);
  const isAdmin = user.role === 'ADMIN';
  const isResponder = doc.responses.some((r) => same(r.responder._id, user._id));
  if (!PUBLIC_STATUSES.includes(doc.status) && !isCreator && !isAdmin) throw new ApiError(404, 'Emergency request not found');
  const out = shape(doc, user);
  // phone is only revealed to an accepted responder, and only if the creator opted in
  const accepted = doc.responses.some((r) => same(r.responder._id, user._id) && r.status === 'ACCEPTED');
  out.creator = { _id: doc.creator._id, name: doc.creator.name, role: doc.creator.role, organizationDetails: doc.creator.organizationDetails ? { orgName: doc.creator.organizationDetails.orgName, verificationStatus: doc.creator.organizationDetails.verificationStatus } : undefined };
  if (accepted && doc.contactPreference === 'SHARE_PHONE_AFTER_MATCH' && doc.creator.phone) out.creatorContact = { phone: doc.creator.phone };
  out.isResponder = isResponder;
  return out;
}

async function update(user, id, data, files) {
  const doc = await EmergencyRequest.findById(id);
  if (!doc) throw new ApiError(404, 'Emergency request not found');
  if (!same(doc.creator, user._id)) throw new ApiError(403, 'Only the creator can edit this request');
  if (doc.status !== 'OPEN') throw new ApiError(409, 'Only OPEN requests can be edited');
  ['title', 'description', 'urgency', 'quantity', 'needBy', 'contactPreference'].forEach((k) => { if (data[k] !== undefined) doc[k] = data[k]; });
  const remove = new Set(data.removeImages || []);
  const removed = doc.images.filter((i) => remove.has(i.url) || remove.has(i.publicId));
  const kept = doc.images.filter((i) => !removed.includes(i));
  if (kept.length + (files?.length || 0) > 5) throw new ApiError(400, 'At most 5 images');
  doc.images = [...kept, ...(await saveImages(files, 'emergencies'))];
  await doc.save();
  await deleteImages(removed);
  return doc;
}

async function respond(user, id, data) {
  if (user.role === 'ADMIN') throw new ApiError(403, 'Administrators cannot respond to requests');
  const doc = await EmergencyRequest.findById(id);
  if (!doc || !PUBLIC_STATUSES.includes(doc.status)) throw new ApiError(404, 'Emergency request not found');
  if (same(doc.creator, user._id)) throw new ApiError(400, 'You cannot respond to your own request');
  if (!['OPEN', 'MATCHED'].includes(doc.status)) throw new ApiError(409, 'This request is no longer accepting offers');
  if (doc.responses.some((r) => same(r.responder, user._id) && ['OFFERED', 'ACCEPTED'].includes(r.status))) throw new ApiError(409, 'You have already offered help on this request');
  doc.responses.push({ responder: user._id, message: data.message, offerType: data.offerType, quantity: data.quantity });
  await doc.save();
  await notify({
    recipient: doc.creator, type: 'EMERGENCY_RESPONSE', title: 'Someone offered help', message: `${user.name} responded to "${doc.title}"`,
    relatedEmergency: doc._id, link: `/emergencies/${doc._id}`,
  });
  return doc.responses[doc.responses.length - 1];
}

async function updateResponse(user, id, responseId, status) {
  const doc = await EmergencyRequest.findById(id);
  if (!doc) throw new ApiError(404, 'Emergency request not found');
  const resp = doc.responses.id(responseId);
  if (!resp) throw new ApiError(404, 'Response not found');
  const isCreator = same(doc.creator, user._id);
  if (status === 'WITHDRAWN') {
    if (!same(resp.responder, user._id)) throw new ApiError(403, 'Only the responder can withdraw an offer');
    if (!['OFFERED', 'ACCEPTED'].includes(resp.status)) throw new ApiError(409, 'Offer can no longer be withdrawn');
  } else {
    if (!isCreator) throw new ApiError(403, 'Only the creator can accept or decline offers');
    if (!['OPEN', 'MATCHED'].includes(doc.status)) throw new ApiError(409, 'This request is not accepting changes to offers');
    if (resp.status !== 'OFFERED') throw new ApiError(409, 'This offer was already handled');
  }
  resp.status = status;
  if (status === 'ACCEPTED' && doc.status === 'OPEN') {
    doc.status = 'MATCHED';
    doc.statusHistory.push({ status: 'MATCHED', by: user._id, note: 'Offer accepted' });
  }
  await doc.save();
  if (status === 'ACCEPTED') {
    await conversations.ensureForEmergency(doc, resp.responder);
    await notify({ recipient: resp.responder, type: 'EMERGENCY_UPDATE', title: 'Your offer was accepted', message: `Please coordinate on "${doc.title}" via chat.`, relatedEmergency: doc._id, link: `/emergencies/${doc._id}` });
  } else if (status === 'DECLINED') {
    await notify({ recipient: resp.responder, type: 'EMERGENCY_UPDATE', title: 'Offer not needed', message: `The creator declined your offer for "${doc.title}". Thank you for helping!`, relatedEmergency: doc._id, link: `/emergencies/${doc._id}` });
  }
  return doc;
}

async function changeStatus(user, id, to, note) {
  const doc = await EmergencyRequest.findById(id);
  if (!doc) throw new ApiError(404, 'Emergency request not found');
  const actor = user.role === 'ADMIN' ? 'admin' : same(doc.creator, user._id) ? 'creator' : null;
  if (!actor) throw new ApiError(403, 'You cannot change the status of this request');
  if (to === 'MATCHED') throw new ApiError(400, 'A request becomes MATCHED when you accept an offer');
  if (!canEmergencyTransition(doc.status, to, actor)) throw new ApiError(409, `Cannot change an emergency request from ${doc.status} to ${to}`);
  if (to === 'FULFILLED' && !doc.responses.some((r) => r.status === 'ACCEPTED')) throw new ApiError(409, 'Accept at least one offer before marking the request fulfilled');

  const from = doc.status;
  const updated = await EmergencyRequest.findOneAndUpdate(
    { _id: doc._id, status: from },
    { $set: { status: to, ...(to === 'FULFILLED' ? { fulfilledAt: new Date() } : {}), ...(actor === 'admin' && note ? { moderationNote: note } : {}) }, $push: { statusHistory: { status: to, by: user._id, note, at: new Date() } } },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'This request was just updated. Refresh and try again.');

  if (to === 'FULFILLED') {
    for (const r of updated.responses.filter((x) => x.status === 'ACCEPTED')) {
      await rewards.award({ userId: r.responder, type: 'COMMUNITY_NEED_FULFILLED', emergencyId: updated._id, description: `Helped fulfil: ${updated.title}` });
      await notify({ recipient: r.responder, type: 'EMERGENCY_UPDATE', title: 'Request fulfilled - thank you!', message: `"${updated.title}" was marked fulfilled.`, relatedEmergency: updated._id, link: `/emergencies/${updated._id}` });
    }
  }
  if (actor === 'admin') {
    await notify({ recipient: updated.creator, type: 'EMERGENCY_UPDATE', title: `Request status: ${to.replace('_', ' ')}`, message: note || `A moderator changed "${updated.title}" to ${to}.`, relatedEmergency: updated._id, link: `/emergencies/${updated._id}` });
  }
  return updated;
}

module.exports = { create, list, getById, update, respond, updateResponse, changeStatus, canCreate, PUBLIC_STATUSES };
