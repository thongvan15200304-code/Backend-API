const Joi = require('joi');

const phoneNumber = Joi.string()
  .trim()
  .pattern(/^\+?[1-9]\d{7,14}$/)
  .required();

const otpCode = Joi.string()
  .trim()
  .pattern(/^\d{6}$/)
  .required();

const requestOtpSchema = Joi.object({
  phone_number: phoneNumber
});

const registerSchema = Joi.object({
  otp_code: otpCode,
  name: Joi.string().trim().min(1).max(100).required()
});

const loginSchema = Joi.object({
  otp_code: otpCode
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100)
});

module.exports = {
  requestOtpSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema
};
