const { Category } = require('../models');
const defaults = require('../config/categories');
const ApiError = require('../utils/ApiError');

async function ensureDefaults() {
  if ((await Category.countDocuments()) > 0) return;
  await Category.insertMany(defaults.map((c) => ({ ...c, active: true })));
}

async function assertActiveCategory(slug) {
  const cat = await Category.findOne({ slug, active: true }).lean();
  if (!cat) throw new ApiError(400, `Unknown or inactive category "${slug}"`);
  return cat;
}

module.exports = { ensureDefaults, assertActiveCategory };
