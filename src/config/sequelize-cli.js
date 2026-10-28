require('dotenv').config();

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'backend_api',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.DB_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {}
};

module.exports = {
  development: common,
  test: { ...common, database: process.env.DB_TEST_NAME || 'backend_api_test' },
  production: common
};
