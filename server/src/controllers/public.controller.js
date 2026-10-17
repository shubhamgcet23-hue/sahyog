const { Category } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const impact = require('../services/impactService');

exports.categories = asyncHandler(async (_req, res) => ok(res, await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 })));
exports.impact = asyncHandler(async (req, res) => ok(res, await impact.getImpact(req.validatedQuery.range)));
