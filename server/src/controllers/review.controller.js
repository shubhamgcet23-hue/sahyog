const { Review, ResourceRequest } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { created } = require('../utils/response');
const trust = require('../services/trustService');
const { notify } = require('../services/notificationService');

exports.create = asyncHandler(async (req, res) => {
  const request = await ResourceRequest.findById(req.body.requestId);
  if (!request) throw new ApiError(404, 'Exchange not found');
  const me = String(req.user._id);
  const isRequester = String(request.requester) === me;
  const isOwner = String(request.owner) === me;
  if (!isRequester && !isOwner) throw new ApiError(403, 'Only participants of an exchange can review it');
  if (request.status !== 'COMPLETED') throw new ApiError(409, 'You can only review completed exchanges');
  const reviewee = isRequester ? request.owner : request.requester;
  let review;
  try {
    review = await Review.create({ request: request._id, reviewer: req.user._id, reviewee, rating: req.body.rating, comment: req.body.comment });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already reviewed this exchange');
    throw err;
  }
  await trust.recompute(reviewee);
  await notify({ recipient: reviewee, type: 'REVIEW_RECEIVED', title: 'You received a review', message: `${req.user.name} rated you ${review.rating}/5`, relatedRequest: request._id, link: `/users/${reviewee}` });
  created(res, review);
});
