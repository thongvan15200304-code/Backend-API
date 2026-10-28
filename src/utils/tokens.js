const jwt = require('jsonwebtoken');
const { getJwtSecrets } = require('../config/env');

const ISSUER = 'backend-otp-auth-api';

function signTemporaryToken(phoneNumber) {
  const { temporary } = getJwtSecrets();
  return jwt.sign(
    { phone_number: phoneNumber, token_type: 'temporary' },
    temporary,
    { expiresIn: process.env.TEMP_TOKEN_TTL || '5m', issuer: ISSUER }
  );
}

function signAccessToken(user) {
  const { access } = getJwtSecrets();
  return jwt.sign(
    { sub: String(user.id), token_type: 'access' },
    access,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || '1h', issuer: ISSUER }
  );
}

function verifyTemporaryToken(token) {
  const { temporary } = getJwtSecrets();
  return jwt.verify(token, temporary, { issuer: ISSUER });
}

function verifyAccessToken(token) {
  const { access } = getJwtSecrets();
  return jwt.verify(token, access, { issuer: ISSUER });
}

module.exports = {
  signTemporaryToken,
  signAccessToken,
  verifyTemporaryToken,
  verifyAccessToken
};
