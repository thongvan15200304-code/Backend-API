const AppError = require('../utils/appError');

function validate(schema, options = {}) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
      allowUnknown: false,
      stripUnknown: false
    });

    if (error) {
      const hasUnknownField = error.details.some((detail) => detail.type === 'object.unknown');
      if (hasUnknownField) {
        return next(new AppError(
          400,
          'VALIDATION_ERR_UNKNOWN_FIELD',
          'Bad Request'
        ));
      }
      return next(new AppError(
        400,
        'VALIDATION_ERR_INVALID_INPUT',
        'Request validation failed'
      ));
    }

    if (options.requireBodyOrFile && Object.keys(value).length === 0 && !req.file) {
      return next(new AppError(
        400,
        'VALIDATION_ERR_INVALID_INPUT',
        'At least one profile field or image is required'
      ));
    }

    req.body = value;
    return next();
  };
}

module.exports = validate;
