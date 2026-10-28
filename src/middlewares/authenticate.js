const AppError = require('../utils/appError');
const {
  verifyTemporaryToken,
  verifyAccessToken
} = require('../utils/tokens');

function authenticateTemporary(req, res, next) {
  const token = req.get('X-Temp-Token');
  if (!token) {
    return next(new AppError(401, 'AUTH_ERR_TEMP_TOKEN_REQUIRED', 'Temporary token is required'));
  }

  try {
    const payload = verifyTemporaryToken(token);
    if (payload.token_type !== 'temporary' || typeof payload.phone_number !== 'string') {
      throw new Error('Invalid temporary token claims');
    }
    req.auth = { phoneNumber: payload.phone_number };
    return next();
  } catch {
    return next(new AppError(401, 'AUTH_ERR_INVALID_TEMP_TOKEN', 'Temporary token is invalid or expired'));
  }
}

function authenticateAccess(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return next(new AppError(401, 'AUTH_ERR_ACCESS_TOKEN_REQUIRED', 'Access token is required'));
  }

  try {
    const payload = verifyAccessToken(match[1]);
    if (payload.token_type !== 'access' || typeof payload.sub !== 'string') {
      throw new Error('Invalid access token claims');
    }
    req.auth = { userId: payload.sub };
    return next();
  } catch {
    return next(new AppError(401, 'AUTH_ERR_INVALID_ACCESS_TOKEN', 'Access token is invalid or expired'));
  }
}

module.exports = { authenticateTemporary, authenticateAccess };
