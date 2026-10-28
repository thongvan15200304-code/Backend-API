const { User } = require('../models');
const AppError = require('../utils/appError');

function serializeUser(user) {
  return {
    id: user.id,
    phone_number: user.phone_number,
    name: user.name,
    profile_image: user.profile_image,
    created_at: user.createdAt,
    updated_at: user.updatedAt
  };
}

async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(404, 'USER_ERR_NOT_FOUND', 'User not found');
  }
  return serializeUser(user);
}

async function updateProfile(userId, updates) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(404, 'USER_ERR_NOT_FOUND', 'User not found');
  }
  const previousImage = user.profile_image;
  if (Object.hasOwn(updates, 'name')) {
    user.name = updates.name;
  }
  if (updates.profileImage) {
    user.profile_image = updates.profileImage;
  }
  await user.save();
  return { profile: serializeUser(user), previousImage };
}

module.exports = { getProfile, updateProfile, serializeUser };
