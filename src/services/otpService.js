const bcrypt = require('bcryptjs');
const { randomInt } = require('node:crypto');
const { Op, Transaction } = require('sequelize');
const { sequelize, OtpVerification, User } = require('../models');
const AppError = require('../utils/appError');
const { signTemporaryToken } = require('../utils/tokens');

const OTP_LIFETIME_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 3;
const MAX_ATTEMPTS = 3;

function getHashRounds() {
  const rounds = Number(process.env.OTP_HASH_ROUNDS || 10);
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 15) {
    throw new Error('OTP_HASH_ROUNDS must be an integer between 4 and 15');
  }
  return rounds;
}

async function requestOtp(phoneNumber) {
  const otpCode = String(randomInt(100000, 1000000));
  const otpHash = await bcrypt.hash(otpCode, getHashRounds());
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtext(:phoneNumber))',
      { replacements: { phoneNumber }, transaction }
    );

    const recentRequestCount = await OtpVerification.count({
      where: {
        phone_number: phoneNumber,
        createdAt: { [Op.gte]: new Date(now.getTime() - REQUEST_WINDOW_MS) }
      },
      transaction
    });

    if (recentRequestCount >= MAX_REQUESTS_PER_HOUR) {
      return false;
    }

    await OtpVerification.create({
      phone_number: phoneNumber,
      otp_hash: otpHash,
      expires_at: new Date(now.getTime() + OTP_LIFETIME_MS),
      attempts: 0
    }, { transaction });
    return true;
  }).then((created) => {
    if (!created) {
      throw new AppError(429, 'OTP_ERR_MAX_REQUEST', 'OTP request limit exceeded');
    }
  });

  return {
    token: signTemporaryToken(phoneNumber),
    ...(process.env.NODE_ENV === 'development' ? { otpCode } : {})
  };
}

async function consumeOtp({ phoneNumber, otpCode, mode, name }) {
  const outcome = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  }, async (transaction) => {
    const verification = await OtpVerification.findOne({
      where: { phone_number: phoneNumber },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!verification) {
      return { error: 'OTP_ERR_NOT_FOUND', status: 400, message: 'No OTP request was found' };
    }
    if (verification.verified_at) {
      return { error: 'OTP_ERR_ALREADY_USED', status: 400, message: 'OTP has already been used' };
    }
    if (verification.expires_at <= new Date()) {
      return { error: 'OTP_ERR_EXPIRED', status: 400, message: 'OTP has expired' };
    }
    if (verification.attempts >= MAX_ATTEMPTS) {
      return { error: 'OTP_ERR_MAX_ATTEMPT', status: 429, message: 'Maximum OTP attempts exceeded' };
    }

    const matches = await bcrypt.compare(otpCode, verification.otp_hash);
    if (!matches) {
      verification.attempts += 1;
      await verification.save({ transaction });
      return { error: 'OTP_ERR_INVALID', status: 400, message: 'OTP is invalid' };
    }

    let user;
    if (mode === 'register') {
      const existingUser = await User.findOne({
        where: { phone_number: phoneNumber },
        transaction
      });
      if (existingUser) {
        return {
          error: 'USER_ERR_ALREADY_EXISTS',
          status: 409,
          message: 'A user with this phone number already exists'
        };
      }
      user = await User.create({ phone_number: phoneNumber, name }, { transaction });
    } else {
      user = await User.findOne({
        where: { phone_number: phoneNumber },
        transaction
      });
      if (!user) {
        return {
          error: 'USER_ERR_NOT_FOUND',
          status: 404,
          message: 'No account is registered for this phone number'
        };
      }
    }

    verification.verified_at = new Date();
    await verification.save({ transaction });
    return { user };
  });

  if (outcome.error) {
    throw new AppError(outcome.status, outcome.error, outcome.message);
  }
  return outcome.user;
}

module.exports = { requestOtp, consumeOtp };
