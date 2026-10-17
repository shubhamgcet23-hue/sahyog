const { OrgVerification, User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { saveImages } = require('../services/uploadService');

exports.submitVerification = asyncHandler(async (req, res) => {
  const org = await User.findById(req.user._id);
  const status = org.organizationDetails?.verificationStatus;
  if (status === 'VERIFIED') throw new ApiError(409, 'Your organization is already verified');
  if (status === 'PENDING') throw new ApiError(409, 'Your application is already under review');
  if (!org.organizationDetails?.orgName) throw new ApiError(400, 'Complete your organization profile first');
  const docs = await saveImages(req.files || [], 'org-docs');
  const application = await OrgVerification.create({
    organization: org._id, message: req.body.message,
    documents: docs.map((d, i) => ({ ...d, name: req.files[i].originalname.slice(0, 80) })),
  });
  org.organizationDetails.verificationStatus = 'PENDING';
  await org.save();
  created(res, application);
});

exports.myVerification = asyncHandler(async (req, res) => {
  const latest = await OrgVerification.findOne({ organization: req.user._id }).sort({ createdAt: -1 });
  ok(res, { status: req.user.organizationDetails?.verificationStatus, note: req.user.organizationDetails?.verificationNote, application: latest });
});
