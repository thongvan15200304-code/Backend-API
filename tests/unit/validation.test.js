const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  requestOtpSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema
} = require('../../src/validations/userValidation');

process.env.JWT_TEMP_SECRET = process.env.JWT_TEMP_SECRET || 'unit-temporary-secret';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'unit-access-secret';
const app = require('../../src/app');

test('OTP request trims and validates an international phone number', () => {
  const result = requestOtpSchema.validate({ phone_number: ' 8562056666666 ' });
  assert.ifError(result.error);
  assert.equal(result.value.phone_number, '8562056666666');
  assert.ok(requestOtpSchema.validate({ phone_number: 'abc' }).error);
});

test('registration requires a six digit OTP and a trimmed name', () => {
  const result = registerSchema.validate({ otp_code: '123456', name: '  Jane Doe  ' });
  assert.ifError(result.error);
  assert.equal(result.value.name, 'Jane Doe');
  assert.ok(registerSchema.validate({ otp_code: '12345', name: 'Jane Doe' }).error);
});

test('login and profile update reject unexpected fields', () => {
  assert.ok(loginSchema.validate({ otp_code: '123456', phone_number: '8562056666666' }).error);
  assert.ok(updateProfileSchema.validate({ phone_number: '8562056666666' }).error);
  assert.ok(updateProfileSchema.validate({ name: 'A', unexpected: true }).error);
});

test('HTTP endpoints return the standard envelope for unknown fields and missing tokens', async () => {
  const unknownField = await request(app)
    .post('/api/users/request-otp')
    .send({ phone_number: '8562056666666', extra: true });
  assert.equal(unknownField.status, 400);
  assert.deepEqual(unknownField.body, {
    error: true,
    code: 'VALIDATION_ERR_UNKNOWN_FIELD',
    message: 'Bad Request',
    data: {}
  });

  const missingTemporaryToken = await request(app)
    .post('/api/users/login')
    .send({ otp_code: '123456' });
  assert.equal(missingTemporaryToken.status, 401);
  assert.equal(missingTemporaryToken.body.code, 'AUTH_ERR_TEMP_TOKEN_REQUIRED');

  const missingAccessToken = await request(app).get('/api/users/profile');
  assert.equal(missingAccessToken.status, 401);
  assert.equal(missingAccessToken.body.code, 'AUTH_ERR_ACCESS_TOKEN_REQUIRED');
});
