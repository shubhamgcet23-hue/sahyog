const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');
const service = require('../services/resourceService');

exports.list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const p = parsePagination(q);
  const { items, total } = await service.search(q, p);
  ok(res, items, pageMeta(p, total));
});

exports.nearby = asyncHandler(async (req, res) => ok(res, await service.nearby(req.validatedQuery)));

exports.get = asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id, req.user)));

exports.create = asyncHandler(async (req, res) => created(res, await service.create(req.user, req.body, req.files)));

exports.update = asyncHandler(async (req, res) => ok(res, await service.update(req.user, req.params.id, req.body, req.files)));

exports.remove = asyncHandler(async (req, res) => {
  await service.remove(req.user, req.params.id);
  ok(res, { message: 'Listing deleted' });
});
