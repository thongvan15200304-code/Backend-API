const dotenv = require('dotenv');

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getJwtSecrets() {
  const temporary = getRequiredEnv('JWT_TEMP_SECRET');
  const access = getRequiredEnv('JWT_ACCESS_SECRET');
  if (temporary === access) {
    throw new Error('JWT_TEMP_SECRET and JWT_ACCESS_SECRET must be different');
  }
  return { temporary, access };
}

module.exports = { getRequiredEnv, getJwtSecrets };
