const { impact } = require('../config/scoring');

const RANGES = {
  week: { days: 7, unit: 'day' },
  month: { days: 30, unit: 'day' },
  year: { days: 365, unit: 'month' },
};

/** Bucket labels (YYYY-MM-DD or YYYY-MM, UTC) for a time range, oldest first. */
function buckets(range, now = new Date()) {
  const { days, unit } = RANGES[range];
  const out = [];
  if (unit === 'day') {
    for (let i = days - 1; i >= 0; i -= 1) {
      out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10));
    }
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
    }
  }
  return out;
}

const startFor = (range, now = new Date()) => {
  const first = buckets(range, now)[0];
  return new Date(first.length === 7 ? `${first}-01T00:00:00Z` : `${first}T00:00:00Z`);
};

/** Estimated kg CO2e avoided from [{category, quantity}] rows. An ESTIMATE using configurable factors. */
function estimateCo2e(rows, cfg = impact) {
  const total = rows.reduce((sum, r) => sum + r.quantity * (cfg.kgCo2ePerItem[r.category] ?? cfg.defaultKgCo2ePerItem), 0);
  return Math.round(total * 10) / 10;
}

module.exports = { RANGES, buckets, startFor, estimateCo2e };
