'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('otp_verifications', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(16),
        allowNull: false
      },
      otp_hash: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addConstraint('otp_verifications', {
      fields: ['attempts'],
      type: 'check',
      where: { attempts: { [Sequelize.Op.between]: [0, 3] } },
      name: 'otp_verifications_attempts_range'
    });
    await queryInterface.addIndex('otp_verifications', ['phone_number', 'created_at'], {
      name: 'otp_verifications_phone_created_idx'
    });
    await queryInterface.addIndex('otp_verifications', ['phone_number', 'expires_at'], {
      name: 'otp_verifications_phone_expires_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otp_verifications');
  }
};
