const fs = require('node:fs');
const path = require('node:path');
const { requestOtp, consumeOtp } = require('../services/otpService');
const { getProfile, updateProfile } = require('../services/userService');
const { signAccessToken } = require('../utils/tokens');
const { success } = require('../utils/response');

async function requestOtpController(req, res) {
  const result = await requestOtp(req.body.phone_number);
  res.set('X-Temp-Token', result.token);
  const data = result.otpCode ? { otp_code: result.otpCode } : {};
  return success(res, data, 201);
}

async function register(req, res) {
  const user = await consumeOtp({
    phoneNumber: req.auth.phoneNumber,
    otpCode: req.body.otp_code,
    mode: 'register',
    name: req.body.name
  });
  return success(res, {
    user: {
      id: user.id,
      phone_number: user.phone_number,
      name: user.name,
      profile_image: user.profile_image
    },
    access_token: signAccessToken(user)
  }, 201);
}

async function login(req, res) {
  const user = await consumeOtp({
    phoneNumber: req.auth.phoneNumber,
    otpCode: req.body.otp_code,
    mode: 'login'
  });
  return success(res, {
    user: {
      id: user.id,
      phone_number: user.phone_number,
      name: user.name,
      profile_image: user.profile_image
    },
    access_token: signAccessToken(user)
  });
}

async function getProfileController(req, res) {
  return success(res, { user: await getProfile(req.auth.userId) });
}

function resolveUploadedImage(imagePath) {
  if (!imagePath || !imagePath.startsWith('/uploads/')) {
    return null;
  }
  const root = path.resolve(process.cwd(), 'uploads');
  const resolved = path.resolve(root, imagePath.slice('/uploads/'.length));
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

async function updateProfileController(req, res) {
  const updates = { ...req.body };
  if (req.file) {
    updates.profileImage = `/uploads/${req.file.filename}`;
  }

  const result = await updateProfile(req.auth.userId, updates);
  const previousImage = resolveUploadedImage(result.previousImage);
  const currentImage = resolveUploadedImage(result.profile.profile_image);
  if (previousImage && previousImage !== currentImage) {
    fs.promises.unlink(previousImage).catch((error) => {
      if (error.code !== 'ENOENT') {
        console.error('Failed to remove replaced profile image:', error.message);
      }
    });
  }

  return success(res, { user: result.profile });
}

module.exports = {
  requestOtpController,
  register,
  login,
  getProfileController,
  updateProfileController
};
