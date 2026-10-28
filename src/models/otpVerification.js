const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('OtpVerification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  phone_number: {
    type: DataTypes.STRING(16),
    allowNull: false
  },
  otp_hash: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 3 }
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'otp_verifications',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['phone_number', 'created_at'] },
    { fields: ['phone_number', 'expires_at'] }
  ]
});
