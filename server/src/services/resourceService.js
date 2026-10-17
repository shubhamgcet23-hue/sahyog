const mongoose = require('mongoose');
const { Resource, ResourceRequest } = require('../models');
const ApiError = require('../utils/ApiError');
const { escapeRegex, approximatePoint, toPoint, approxKm } = require('../utils/geo');
const { ACTIVE_REQUEST_STATUSES } = require('../utils/stateMachine');
const { assertActiveCategory } = require('./categoryService');
const { saveImages, deleteImages } = require('./uploadService');
const { limits } = require('../config/scoring');

const OID = mongoose.Types.ObjectId;

const ownerLookup = [
  { $lookup: { from: 'users', let: { ownerId: '$owner' }, as: 'ownerDoc', pipeline: [
    { $match: { $expr: { $eq: ['$_id', '$$ownerId'] } } },
    { $project: { name: 1, role: 1, trustScore: 1, profileImage: 1, 'organizationDetails.orgName': 1, 'organizationDetails.verificationStatus': 1 } },
  ] } },
  { $addFields: { owner: { $arrayElemAt: ['$ownerDoc', 0] } } },
  { $project: { ownerDoc: 0, addressDetail: 0, __v: 0 } },
];

/** Public list shape: coordinates rounded to ~1 km, distance rounded to 0.1 km. */
function publicShape(r) {
  const out = { ...r, location: approximatePoint(r.location, 2) };
  if (typeof r.distanceMeters === 'number') {
    out.distanceKm = approxKm(r.distanceMeters);
    delete out.distanceMeters;
  }
  return out;
}

function buildMatch(q) {
  const match = { status: q.availability === 'all' ? { $in: ['AVAILABLE', 'UNAVAILABLE'] } : 'AVAILABLE' };
  if (q.availability !== 'all') match.availableQuantity = { $gt: 0 };
  if (q.category) match.category = q.category;
  if (q.type) match.availabilityType = q.type;
  if (q.condition) match.condition = q.condition;
  if (q.owner) match.owner = new OID(q.owner);
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    match.$or = [{ title: rx }, { description: rx }];
  }
  return match;
}

async function search(q, { page = 1, limit = 12 } = {}) {
  const match = buildMatch(q);
  const hasGeo = q.lat !== undefined && q.lng !== undefined;
  const pipeline = [];
  if (hasGeo) {
    pipeline.push({
      $geoNear: { near: toPoint(q.lat, q.lng), distanceField: 'distanceMeters', maxDistance: q.radiusKm * 1000, spherical: true, query: match },
    });
    if (q.sort !== 'nearest') pipeline.push({ $sort: { createdAt: -1 } });
  } else {
    pipeline.push({ $match: match }, { $sort: { createdAt: -1 } });
  }
  pipeline.push({
    $facet: {
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...ownerLookup],
      total: [{ $count: 'n' }],
    },
  });
  const [out] = await Resource.aggregate(pipeline);
  return { items: out.items.map(publicShape), total: out.total[0]?.n || 0 };
}

async function nearby(q) {
  const match = { status: 'AVAILABLE', availableQuantity: { $gt: 0 } };
  if (q.category) match.category = q.category;
  if (q.type) match.availabilityType = q.type;
  const items = await Resource.aggregate([
    { $geoNear: { near: toPoint(q.lat, q.lng), distanceField: 'distanceMeters', maxDistance: q.radiusKm * 1000, spherical: true, query: match } },
    { $limit: q.limit },
    { $project: { title: 1, category: 1, availabilityType: 1, location: 1, images: { $slice: ['$images', 1] }, distanceMeters: 1, availableQuantity: 1, areaLabel: 1 } },
  ]);
  return items.map(publicShape);
}

/** Does this viewer have an approved/in-progress exchange for the resource (=> may see precise pickup info)? */
async function hasPreciseAccess(resourceId, viewerId) {
  if (!viewerId) return false;
  return Boolean(await ResourceRequest.exists({ resource: resourceId, requester: viewerId, status: { $in: ['APPROVED', 'IN_PROGRESS'] } }));
}

async function getById(id, viewer) {
  const doc = await Resource.findById(id).select('+addressDetail').populate('owner', 'name role trustScore profileImage organizationDetails.orgName organizationDetails.verificationStatus createdAt');
  if (!doc) throw new ApiError(404, 'Resource not found');
  const isOwner = viewer && String(doc.owner._id) === String(viewer._id);
  const isAdmin = viewer?.role === 'ADMIN';
  if (doc.status === 'HIDDEN' && !isOwner && !isAdmin) throw new ApiError(404, 'Resource not found');
  const precise = isOwner || isAdmin || (await hasPreciseAccess(doc._id, viewer?._id));
  const obj = doc.toJSON();
  if (!precise) {
    obj.location = approximatePoint(obj.location, 2);
    delete obj.addressDetail;
  }
  obj.preciseLocationVisible = Boolean(precise);
  if (viewer && !isOwner) {
    // lets the UI show "your request: pending" instead of offering a duplicate request
    const open = await ResourceRequest.findOne({ resource: doc._id, requester: viewer._id, status: { $in: ACTIVE_REQUEST_STATUSES } }).select('status');
    if (open) obj.viewerRequest = { _id: open._id, status: open.status };
  }
  return obj;
}

async function create(user, data, files) {
  await assertActiveCategory(data.category);
  if (user.role === 'ADMIN') throw new ApiError(403, 'Administrators cannot create listings');
  const images = await saveImages(files, 'resources');
  return Resource.create({
    owner: user._id,
    title: data.title,
    description: data.description,
    category: data.category,
    subcategory: data.subcategory,
    condition: data.condition,
    availabilityType: data.availabilityType,
    quantity: data.quantity,
    availableQuantity: data.quantity,
    location: toPoint(data.lat, data.lng),
    areaLabel: data.areaLabel,
    addressDetail: data.addressDetail,
    availabilityDates: { from: data.availableFrom, to: data.availableTo },
    images,
  });
}

async function update(user, id, data, files) {
  const doc = await Resource.findById(id).select('+addressDetail');
  if (!doc) throw new ApiError(404, 'Resource not found');
  if (String(doc.owner) !== String(user._id)) throw new ApiError(403, 'You can only edit your own listings');
  if (doc.status === 'HIDDEN') throw new ApiError(403, 'This listing was hidden by a moderator and cannot be edited');

  if (data.category && data.category !== doc.category) await assertActiveCategory(data.category);

  if (data.availabilityType && data.availabilityType !== doc.availabilityType) {
    const active = await ResourceRequest.countDocuments({ resource: doc._id, status: { $in: ACTIVE_REQUEST_STATUSES } });
    if (active) throw new ApiError(409, 'You cannot change the listing type while it has active requests');
  }

  if (data.quantity !== undefined) {
    const reserved = doc.quantity - doc.availableQuantity;
    if (data.quantity < reserved) throw new ApiError(409, `${reserved} unit(s) are reserved by approved requests; quantity cannot go below that`);
    doc.availableQuantity = data.quantity - reserved;
    doc.quantity = data.quantity;
  }

  ['title', 'description', 'category', 'subcategory', 'condition', 'availabilityType', 'areaLabel', 'addressDetail'].forEach((k) => {
    if (data[k] !== undefined) doc[k] = data[k];
  });
  if ((data.lat === undefined) !== (data.lng === undefined)) throw new ApiError(400, 'Provide both lat and lng to change the location');
  if (data.lat !== undefined) doc.location = toPoint(data.lat, data.lng);
  if (data.availableFrom !== undefined || data.availableTo !== undefined) {
    doc.availabilityDates = { from: data.availableFrom ?? doc.availabilityDates?.from, to: data.availableTo ?? doc.availabilityDates?.to };
  }

  const remove = new Set(data.removeImages || []);
  const removed = doc.images.filter((i) => remove.has(i.url) || remove.has(i.publicId));
  const kept = doc.images.filter((i) => !removed.includes(i));
  if (kept.length + (files?.length || 0) > limits.maxImages) throw new ApiError(400, `A listing can have at most ${limits.maxImages} images`);
  const added = await saveImages(files, 'resources');
  doc.images = [...kept, ...added];

  doc.status = doc.availableQuantity > 0 ? 'AVAILABLE' : 'UNAVAILABLE';
  await doc.save();
  await deleteImages(removed);
  return doc;
}

async function remove(user, id) {
  const doc = await Resource.findById(id);
  if (!doc) throw new ApiError(404, 'Resource not found');
  const isOwner = String(doc.owner) === String(user._id);
  if (!isOwner && user.role !== 'ADMIN') throw new ApiError(403, 'You can only delete your own listings');
  const inFlight = await ResourceRequest.countDocuments({ resource: doc._id, status: { $in: ['APPROVED', 'IN_PROGRESS'] } });
  if (inFlight) throw new ApiError(409, 'Complete or cancel the approved requests before deleting this listing');
  // pending requests are cancelled automatically
  await ResourceRequest.updateMany(
    { resource: doc._id, status: 'PENDING' },
    { $set: { status: 'CANCELLED', cancelledBy: 'owner' }, $push: { statusHistory: { status: 'CANCELLED', by: user._id, note: 'Listing removed', at: new Date() } } }
  );
  await deleteImages(doc.images);
  await doc.deleteOne();
}

module.exports = { search, nearby, getById, create, update, remove };
