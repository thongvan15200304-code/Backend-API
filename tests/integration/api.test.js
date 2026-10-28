const test = require('node:test');
const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

require('dotenv').config();
const databaseName = process.env.DB_TEST_NAME || 'backend_api_test';
if (!/test/i.test(databaseName)) {
  throw new Error('DB_TEST_NAME must include "test" to protect non-test databases');
}
process.env.NODE_ENV = 'development';
process.env.DB_NAME = databaseName;
process.env.JWT_TEMP_SECRET = process.env.JWT_TEMP_SECRET || 'integration-temporary-secret';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'integration-access-secret';

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, OtpVerification } = require('../../src/models');

test('OTP auth, rate limits, profile endpoints, and single-use behavior', {
  timeout: 60000
}, async (t) => {
  const phoneNumbers = new Set();
  const uploadedImages = new Set();
  let connected = false;
  const nextPhone = () => {
    const phone = `856${String(randomInt(1000000000, 10000000000))}`;
    phoneNumbers.add(phone);
    return phone;
  };
  const issueOtp = async (phone) => {
    const response = await request(app)
      .post('/api/users/request-otp')
      .send({ phone_number: phone });
    assert.equal(response.status, 201);
    assert.equal(response.body.error, false);
    assert.match(response.headers['x-temp-token'], /^.+$/);
    assert.equal(response.body.data.otp_code.length, 6);
    return {
      token: response.headers['x-temp-token'],
      code: response.body.data.otp_code
    };
  };

  t.after(async () => {
    if (connected) {
      for (const phone of phoneNumbers) {
        await OtpVerification.destroy({ where: { phone_number: phone } });
        await User.destroy({ where: { phone_number: phone } });
      }
      for (const imagePath of uploadedImages) {
        await fs.unlink(path.resolve(process.cwd(), imagePath.slice(1))).catch((error) => {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        });
      }
    }
    await sequelize.close();
  });

  await sequelize.authenticate();
  connected = true;

  const unknownField = await request(app)
    .post('/api/users/request-otp')
    .send({ phone_number: nextPhone(), extra: true });
  assert.equal(unknownField.status, 400);
  assert.deepEqual(unknownField.body, {
    error: true,
    code: 'VALIDATION_ERR_UNKNOWN_FIELD',
    message: 'Bad Request',
    data: {}
  });

  const missingTempToken = await request(app)
    .post('/api/users/login')
    .send({ otp_code: '123456' });
  assert.equal(missingTempToken.status, 401);
  const invalidTempToken = await request(app)
    .post('/api/users/login')
    .set('X-Temp-Token', 'invalid')
    .send({ otp_code: '123456' });
  assert.equal(invalidTempToken.status, 401);

  const rateLimitedPhone = nextPhone();
  await issueOtp(rateLimitedPhone);
  await issueOtp(rateLimitedPhone);
  await issueOtp(rateLimitedPhone);
  const fourthRequest = await request(app)
    .post('/api/users/request-otp')
    .send({ phone_number: rateLimitedPhone });
  assert.equal(fourthRequest.status, 429);
  assert.equal(fourthRequest.body.code, 'OTP_ERR_MAX_REQUEST');
  await OtpVerification.update(
    { createdAt: new Date(Date.now() - 60 * 60 * 1000 - 1000) },
    { where: { phone_number: rateLimitedPhone } }
  );
  assert.equal((await issueOtp(rateLimitedPhone)).code.length, 6);

  const exhaustedPhone = nextPhone();
  const exhaustedOtp = await issueOtp(exhaustedPhone);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request(app)
      .post('/api/users/register')
      .set('X-Temp-Token', exhaustedOtp.token)
      .send({ otp_code: '000000', name: 'Unused User' });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'OTP_ERR_INVALID');
  }
  const excessiveAttempt = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', exhaustedOtp.token)
    .send({ otp_code: exhaustedOtp.code, name: 'Unused User' });
  assert.equal(excessiveAttempt.status, 429);
  assert.equal(excessiveAttempt.body.code, 'OTP_ERR_MAX_ATTEMPT');

  const expiredPhone = nextPhone();
  const expiredOtp = await issueOtp(expiredPhone);
  await OtpVerification.update(
    { expires_at: new Date(Date.now() - 1000) },
    { where: { phone_number: expiredPhone } }
  );
  const expiredResponse = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', expiredOtp.token)
    .send({ otp_code: expiredOtp.code, name: 'Expired User' });
  assert.equal(expiredResponse.status, 400);
  assert.equal(expiredResponse.body.code, 'OTP_ERR_EXPIRED');

  const unregisteredPhone = nextPhone();
  const unregisteredOtp = await issueOtp(unregisteredPhone);
  const unregisteredLogin = await request(app)
    .post('/api/users/login')
    .set('X-Temp-Token', unregisteredOtp.token)
    .send({ otp_code: unregisteredOtp.code });
  assert.equal(unregisteredLogin.status, 404);
  assert.equal(unregisteredLogin.body.code, 'USER_ERR_NOT_FOUND');
  const registrationAfterLoginFailure = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', unregisteredOtp.token)
    .send({ otp_code: unregisteredOtp.code, name: 'Registered User' });
  assert.equal(registrationAfterLoginFailure.status, 201);

  const phone = nextPhone();
  const registrationOtp = await issueOtp(phone);
  const wrongOtp = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', registrationOtp.token)
    .send({ otp_code: '000000', name: 'Jane Doe' });
  assert.equal(wrongOtp.body.code, 'OTP_ERR_INVALID');

  const registration = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', registrationOtp.token)
    .send({ otp_code: registrationOtp.code, name: 'Jane Doe' });
  assert.equal(registration.status, 201);
  const accessToken = registration.body.data.access_token;
  const replay = await request(app)
    .post('/api/users/register')
    .set('X-Temp-Token', registrationOtp.token)
    .send({ otp_code: registrationOtp.code, name: 'Jane Doe' });
  assert.equal(replay.body.code, 'OTP_ERR_ALREADY_USED');

  const loginOtp = await issueOtp(phone);
  const login = await request(app)
    .post('/api/users/login')
    .set('X-Temp-Token', loginOtp.token)
    .send({ otp_code: loginOtp.code });
  assert.equal(login.status, 200);
  const loginReplay = await request(app)
    .post('/api/users/login')
    .set('X-Temp-Token', loginOtp.token)
    .send({ otp_code: loginOtp.code });
  assert.equal(loginReplay.body.code, 'OTP_ERR_ALREADY_USED');

  const missingAccessToken = await request(app).get('/api/users/profile');
  assert.equal(missingAccessToken.status, 401);
  const invalidAccessToken = await request(app)
    .get('/api/users/profile')
    .set('Authorization', 'Bearer invalid');
  assert.equal(invalidAccessToken.status, 401);

  const profile = await request(app)
    .get('/api/users/profile')
    .set('Authorization', `Bearer ${accessToken}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.phone_number, phone);
  assert.equal(profile.body.data.user.name, 'Jane Doe');

  const phoneUpdate = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ phone_number: nextPhone(), name: 'Changed Name' });
  assert.equal(phoneUpdate.status, 400);
  assert.equal(phoneUpdate.body.code, 'VALIDATION_ERR_UNKNOWN_FIELD');
  const profileUpdate = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: '  Jane Updated  ' });
  assert.equal(profileUpdate.status, 200);
  assert.equal(profileUpdate.body.data.user.name, 'Jane Updated');

  const image = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('profile_image', Buffer.from('89504e470d0a1a0a', 'hex'), {
      filename: 'profile.png',
      contentType: 'image/png'
    });
  assert.equal(image.status, 200);
  uploadedImages.add(image.body.data.user.profile_image);
  assert.match(image.body.data.user.profile_image, /^\/uploads\/.+\.png$/);

  const invalidImage = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('profile_image', Buffer.from('not an image'), {
      filename: 'profile.png',
      contentType: 'image/png'
    });
  assert.equal(invalidImage.status, 400);
  assert.equal(invalidImage.body.code, 'UPLOAD_ERR_INVALID_TYPE');
});
