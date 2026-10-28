# Backend OTP Authentication API

A REST API built with Node.js, Express, PostgreSQL, Sequelize, Joi, bcryptjs, and JWT. Users verify a one-time password (OTP) sent to their phone before registering or logging in. Authenticated users can view and update their profile.

## Prerequisites

- Node.js 18.11 or later and npm
- PostgreSQL 12 or later
- A PostgreSQL database and user that the application can access

## Installation and configuration

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set your PostgreSQL credentials and two independent, strong JWT secrets. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `development` to include OTP codes in request responses; use `production` outside local development. |
| `PORT` | HTTP port (default `3000`). |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection settings. |
| `DB_TEST_NAME` | Separate database for integration testing (default `backend_api_test`). |
| `DB_SSL` | Set to `true` to enable PostgreSQL TLS. |
| `JWT_TEMP_SECRET` | Secret used only to sign short-lived OTP-flow tokens. |
| `JWT_ACCESS_SECRET` | Different secret used only to sign access tokens. |
| `TEMP_TOKEN_TTL` | Temporary token lifetime (default `5m`). |
| `ACCESS_TOKEN_TTL` | Access token lifetime (default `1h`). |
| `OTP_HASH_ROUNDS` | bcrypt work factor (integer from 4 to 15; default `10`). |

`JWT_TEMP_SECRET` and `JWT_ACCESS_SECRET` must be different. The application fails to start if either is missing or they are identical. Generate independent secrets using a trusted local secret generator; never reuse the example values.

## PostgreSQL and migrations

Create an empty PostgreSQL **database** and configure its connection details in `.env`. For example, with PostgreSQL command-line tools installed:

```powershell
createdb backend_api
npm run db:migrate -- --env development
```

The Sequelize migrations create the `users` and `otp_verifications` tables, constraints, and indexes. No tables need to be created manually, and the application does not use `sync({ force: true })`.

To undo the latest migration:

```powershell
npm run db:migrate:undo -- --env development
```

## Run the server

```powershell
npm start
```

For development with Node's watch mode:

```powershell
npm run dev
```

The server checks the JWT configuration and authenticates its PostgreSQL connection before listening. In development mode, the OTP endpoint returns the code in its response for testing; OTPs are never returned in other modes.

## API conventions

Base URL: `http://localhost:3000`

All responses use this envelope:

```json
{
  "error": false,
  "code": 0,
  "message": "Success",
  "data": {}
}
```

Errors use the same structure with `error: true`, a string `code`, a descriptive `message`, and empty `data`. Unknown request-body fields return HTTP 400 with `VALIDATION_ERR_UNKNOWN_FIELD` and message `Bad Request`.

Phone numbers must be 8–15 digits in international format, optionally prefixed by `+`. OTP codes are six digits and expire after one minute. A phone number can request at most three OTPs in any rolling hour. Each OTP permits three incorrect attempts and can be consumed only once.

### Request OTP

`POST /api/users/request-otp`

Request:

```json
{ "phone_number": "8562056666666" }
```

Success: HTTP 201. The response includes an `X-Temp-Token` header. The body `data.otp_code` is present only when `NODE_ENV=development`; otherwise `data` is empty.

```json
{
  "error": false,
  "code": 0,
  "message": "Success",
  "data": { "otp_code": "123456" }
}
```

The temporary JWT contains `phone_number` and `token_type: "temporary"`. Send it as `X-Temp-Token` to register or log in. A fourth request during the rolling hour returns HTTP 429 and `OTP_ERR_MAX_REQUEST`.

### Register

`POST /api/users/register`

Headers: `X-Temp-Token: <temporary-token>`

Request:

```json
{ "otp_code": "123456", "name": "John Doe" }
```

Success: HTTP 201 with the user and an access token in `data.access_token`. The phone number comes from the signed temporary token, not the request body. Registration creates the user and consumes the OTP in one database transaction.

### Login

`POST /api/users/login`

Headers: `X-Temp-Token: <temporary-token>`

Request:

```json
{ "otp_code": "123456" }
```

Success: HTTP 200 with the existing user and an access token. Login never creates an account. A valid OTP for an unregistered number returns HTTP 404 and `USER_ERR_NOT_FOUND` without consuming the OTP.

### Get profile

`GET /api/users/profile`

Headers: `Authorization: Bearer <access-token>`

Success: HTTP 200 with the authenticated user's profile in `data.user`. The user is selected only from the verified JWT subject.

### Update profile

`PATCH /api/users/profile`

Headers: `Authorization: Bearer <access-token>`

Update the name with JSON:

```json
{ "name": "Jane Doe" }
```

Or upload an image using `multipart/form-data` with a `profile_image` file field (optionally alongside `name`). Images must be JPEG, PNG, GIF, or WebP, match the file signature, and be no larger than 5 MB. They are stored under `/uploads` and served at that path. `phone_number` cannot be changed; unknown fields are rejected.

## Error codes

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERR_UNKNOWN_FIELD` | 400 | Request contains an unsupported field. |
| `VALIDATION_ERR_INVALID_INPUT` | 400 | A required field or value is invalid. |
| `AUTH_ERR_TEMP_TOKEN_REQUIRED` / `AUTH_ERR_INVALID_TEMP_TOKEN` | 401 | Temporary token is missing, invalid, or expired. |
| `AUTH_ERR_ACCESS_TOKEN_REQUIRED` / `AUTH_ERR_INVALID_ACCESS_TOKEN` | 401 | Access token is missing, invalid, or expired. |
| `OTP_ERR_INVALID` | 400 | OTP does not match. |
| `OTP_ERR_EXPIRED` | 400 | OTP has expired. |
| `OTP_ERR_ALREADY_USED` | 400 | OTP has already been consumed. |
| `OTP_ERR_MAX_ATTEMPT` | 429 | Three incorrect OTP attempts have already been made. |
| `OTP_ERR_MAX_REQUEST` | 429 | Three OTP requests have already been made during the rolling hour. |
| `USER_ERR_NOT_FOUND` | 404 | No account exists for the phone number. |
| `USER_ERR_ALREADY_EXISTS` | 409 | The phone number is already registered. |

## Postman

Import [`postman/Backend-API.postman_collection.json`](./postman/Backend-API.postman_collection.json) into Postman. Set `baseUrl` to `http://localhost:3000` and `phoneNumber` to a test number. The collection saves the temporary token and development OTP after an OTP request, then saves the access token after registration/login. Use a fresh phone number for registration.

## Tests

Run unit tests:

```powershell
npm test
```

The integration suite exercises OTP issuance and rate limiting, invalid/expired/exhausted/reused OTPs, registration, existing and unregistered login, missing/invalid tokens, profile updates, unknown fields, and image uploads. It requires a separate migrated PostgreSQL test database:

```powershell
createdb backend_api_test
npm run db:migrate -- --env test
npm run test:integration
```

`npm run test:integration` creates the database if needed and applies pending migrations automatically. Set `DB_TEST_NAME` in `.env` if the test database has a different name; its name must be a valid PostgreSQL identifier containing `test` to protect non-test databases. The PostgreSQL user must have permission to create databases the first time; alternatively, create the test database yourself with `createdb backend_api_test`.
