const express = require('express');
const controller = require('../controllers/userController');
const validate = require('../middlewares/validate');
const {
  authenticateTemporary,
  authenticateAccess
} = require('../middlewares/authenticate');
const { upload, validateImageSignature } = require('../middlewares/upload');
const {
  requestOtpSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema
} = require('../validations/userValidation');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/request-otp',
  validate(requestOtpSchema),
  asyncHandler(controller.requestOtpController)
);
router.post(
  '/register',
  authenticateTemporary,
  validate(registerSchema),
  asyncHandler(controller.register)
);
router.post(
  '/login',
  authenticateTemporary,
  validate(loginSchema),
  asyncHandler(controller.login)
);
router.get(
  '/profile',
  authenticateAccess,
  asyncHandler(controller.getProfileController)
);
router.patch(
  '/profile',
  authenticateAccess,
  upload.single('profile_image'),
  validateImageSignature,
  validate(updateProfileSchema, { requireBodyOrFile: true }),
  asyncHandler(controller.updateProfileController)
);

module.exports = router;
