const { Resource } = require('../models');

/** Recompute AVAILABLE/UNAVAILABLE from stock without touching HIDDEN (moderated) listings. */
const syncStatus = (resourceId) =>
  Resource.updateOne(
    { _id: resourceId, status: { $in: ['AVAILABLE', 'UNAVAILABLE'] } },
    [{ $set: { status: { $cond: [{ $lte: ['$availableQuantity', 0] }, 'UNAVAILABLE', 'AVAILABLE'] } } }]
  );

/**
 * Atomically reserve stock. The availableQuantity >= qty condition lives inside the update filter,
 * so two concurrent approvals can never over-allocate. Returns the updated resource or null.
 */
async function reserve(resourceId, qty) {
  const res = await Resource.findOneAndUpdate(
    { _id: resourceId, availableQuantity: { $gte: qty } },
    { $inc: { availableQuantity: -qty } },
    { new: true }
  );
  if (res) await syncStatus(resourceId);
  return res;
}

/** Give stock back (cancelled approval, or a borrowed/shared item returned). Never exceeds `quantity`. */
async function release(resourceId, qty) {
  await Resource.updateOne({ _id: resourceId }, [
    { $set: { availableQuantity: { $min: ['$quantity', { $add: ['$availableQuantity', qty] }] } } },
  ]);
  await syncStatus(resourceId);
}

/** A donation was handed over: the item leaves the pool permanently. */
async function consumeDonation(resourceId, qty) {
  await Resource.updateOne({ _id: resourceId }, [
    { $set: { quantity: { $max: [0, { $subtract: ['$quantity', qty] }] } } },
  ]);
}

module.exports = { reserve, release, consumeDonation, syncStatus };
