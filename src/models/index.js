const sequelize = require('../config/database');
const defineUser = require('./user');
const defineOtpVerification = require('./otpVerification');

const User = defineUser(sequelize);
const OtpVerification = defineOtpVerification(sequelize);

module.exports = { sequelize, User, OtpVerification };
