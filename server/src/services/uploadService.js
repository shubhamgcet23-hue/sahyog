const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let cloudinary;
function getCloudinary() {
  if (!env.cloudinaryEnabled) return null;
  if (!cloudinary) {
    // eslint-disable-next-line global-require
    cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  }
  return cloudinary;
}

/** Verify the file really is the image type it claims (magic bytes), not just the client-supplied MIME type. */
function hasValidSignature(file) {
  const b = file.buffer;
  if (!b || b.length < 12) return false;
  if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === 'image/png') return b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
  return false;
}

async function saveOne(file, folder) {
  if (!hasValidSignature(file)) throw new ApiError(400, `"${file.originalname}" is not a valid image file`);
  const cld = getCloudinary();
  if (cld) {
    return new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream({ folder: `sahyog/${folder}`, resource_type: 'image' }, (err, result) => {
        if (err) return reject(new ApiError(502, 'Image upload failed. Please try again.'));
        return resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.end(file.buffer);
    });
  }
  // Local fallback for development without Cloudinary
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${EXT[file.mimetype]}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: `${env.SERVER_URL}/uploads/${name}`, publicId: `local:${name}` };
}

const saveImages = (files = [], folder = 'misc') => Promise.all(files.map((f) => saveOne(f, folder)));

async function deleteImages(images = []) {
  await Promise.all(
    images.map(async (img) => {
      try {
        if (!img.publicId) return;
        if (img.publicId.startsWith('local:')) {
          await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(img.publicId.slice(6))));
        } else {
          const cld = getCloudinary();
          if (cld) await cld.uploader.destroy(img.publicId);
        }
      } catch (_) { /* best effort */ }
    })
  );
}

module.exports = { saveImages, deleteImages, UPLOAD_DIR };
