const fs = require('node:fs');
const multer = require('multer');
const AppError = require('../utils/appError');
const { failure } = require('../utils/response');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (req.file && req.file.path) {
    fs.promises.unlink(req.file.path).catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') {
        console.error('Failed to remove rejected upload:', cleanupError.message);
      }
    });
  }

  if (error instanceof AppError) {
    return failure(res, error.status, error.code, error.message);
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return failure(res, 400, 'VALIDATION_ERR_UNKNOWN_FIELD', 'Bad Request');
    }
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return failure(
      res,
      400,
      tooLarge ? 'UPLOAD_ERR_FILE_TOO_LARGE' : 'UPLOAD_ERR_INVALID_FILE',
      tooLarge ? 'Image must be 5 MB or smaller' : 'Invalid image upload'
    );
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return failure(res, 400, 'VALIDATION_ERR_INVALID_JSON', 'Request body must contain valid JSON');
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return failure(res, 409, 'USER_ERR_ALREADY_EXISTS', 'A user with this phone number already exists');
  }

  if (error.name === 'SequelizeValidationError') {
    return failure(res, 400, 'VALIDATION_ERR_INVALID_INPUT', 'Request validation failed');
  }

  console.error('Unhandled application error:', error.message);
  return failure(res, 500, 'INTERNAL_ERR_SERVER', 'Internal server error');
}

module.exports = errorHandler;
