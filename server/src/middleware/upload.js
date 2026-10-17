const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { limits } = require('../config/scoring');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED.includes(file.mimetype)) return cb(new ApiError(400, 'Only JPEG, PNG or WebP images are allowed'));
  return cb(null, true);
};

const make = (maxFiles) => multer({ storage, fileFilter, limits: { fileSize: limits.maxImageBytes, files: maxFiles } });

module.exports = {
  images: make(limits.maxImages).array('images', limits.maxImages),
  avatar: make(1).single('profileImage'),
  documents: make(3).array('documents', 3),
};
