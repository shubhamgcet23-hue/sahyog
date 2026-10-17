const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { parsePagination, pageMeta } = require('../utils/pagination');
const service = require('../services/emergencyService');

exports.create = asyncHandler(async (req, res) => created(res, await service.create(req.user, req.body, req.files)));
exports.list = asyncHandler(async (req, res) => {
  const p = parsePagination(req.validatedQuery, { defaultLimit: 12 });
  const { items, total } = await service.list(req.user, req.validatedQuery, p);
  ok(res, items, pageMeta(p, total));
});
exports.get = asyncHandler(async (req, res) => ok(res, await service.getById(req.user, req.params.id)));
exports.update = asyncHandler(async (req, res) => ok(res, await service.update(req.user, req.params.id, req.body, req.files)));
exports.respond = asyncHandler(async (req, res) => created(res, await service.respond(req.user, req.params.id, req.body)));
exports.updateResponse = asyncHandler(async (req, res) => ok(res, await service.updateResponse(req.user, req.params.id, req.params.responseId, req.body.status)));
exports.status = asyncHandler(async (req, res) => ok(res, await service.changeStatus(req.user, req.params.id, req.body.status, req.body.note)));
