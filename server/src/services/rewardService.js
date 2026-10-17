const { RewardTransaction, User } = require('../models');
const { rewards } = require('../config/scoring');
const logger = require('../utils/logger');

const startOfUtcDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

/**
 * Award points exactly once per (type, user, exchange/emergency): the unique dedupeKey index is the guard,
 * so retries or double-clicks can never double-pay. A daily cap limits point farming.
 * Returns the ledger row, or null when skipped (duplicate / cap reached / unknown type).
 */
async function award({ userId, type, requestId, emergencyId, description }) {
  const points = rewards.points[type];
  if (!points || !userId) return null;
  const ref = requestId || emergencyId;
  const dedupeKey = `${type}:${userId}:${ref}`;

  const todays = await RewardTransaction.aggregate([
    { $match: { user: userId, kind: 'EARNED', createdAt: { $gte: startOfUtcDay() } } },
    { $group: { _id: null, sum: { $sum: '$points' } } },
  ]);
  if ((todays[0]?.sum || 0) + points > rewards.dailyCap) {
    logger.warn('Reward skipped: daily cap reached', { userId: String(userId), type });
    return null;
  }
  try {
    const tx = await RewardTransaction.create({
      user: userId, points, kind: 'EARNED', transactionType: type, relatedExchange: requestId, relatedEmergency: emergencyId, description, dedupeKey,
    });
    await User.updateOne({ _id: userId }, { $inc: { rewardPoints: points } });
    return tx;
  } catch (err) {
    if (err.code === 11000) return null; // already awarded
    throw err;
  }
}

/** Reverse every (not yet reversed) EARNED row for an exchange, e.g. after confirmed fraud. */
async function reverseForExchange(requestId, reason = 'Reversed by moderation') {
  const earned = await RewardTransaction.find({ relatedExchange: requestId, kind: 'EARNED' });
  const reversed = [];
  for (const tx of earned) {
    try {
      const rev = await RewardTransaction.create({
        user: tx.user, points: -tx.points, kind: 'REVERSED', transactionType: 'REVERSAL', relatedExchange: requestId,
        reverses: tx._id, description: reason, dedupeKey: `REVERSAL:${tx._id}`,
      });
      await User.updateOne({ _id: tx.user }, [{ $set: { rewardPoints: { $max: [0, { $add: ['$rewardPoints', -tx.points] }] } } }]);
      reversed.push(rev);
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  return reversed;
}

module.exports = { award, reverseForExchange };
