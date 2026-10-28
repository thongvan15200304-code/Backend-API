const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const AppError = require('../utils/appError');

const uploadDirectory = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionsByMimeType = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    callback(null, `${randomUUID()}${extensionsByMimeType[file.mimetype] || ''}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!Object.hasOwn(extensionsByMimeType, file.mimetype)) {
      return callback(new AppError(400, 'UPLOAD_ERR_INVALID_TYPE', 'Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
    return callback(null, true);
  }
});

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/gif') {
    return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  }
  return mimeType === 'image/webp'
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

async function validateImageSignature(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const file = await fs.promises.open(req.file.path, 'r');
    let header;
    try {
      header = Buffer.alloc(12);
      const { bytesRead } = await file.read(header, 0, header.length, 0);
      header = header.subarray(0, bytesRead);
    } finally {
      await file.close();
    }

    if (!hasValidImageSignature(header, req.file.mimetype)) {
      return next(new AppError(400, 'UPLOAD_ERR_INVALID_TYPE', 'Uploaded file is not a valid image'));
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { upload, validateImageSignature, uploadDirectory };
