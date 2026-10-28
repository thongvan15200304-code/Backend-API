const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  phone_number: {
    type: DataTypes.STRING(16),
    allowNull: false,
    unique: true,
    validate: {
      is: /^\+?[1-9]\d{7,14}$/
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  profile_image: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true
});
