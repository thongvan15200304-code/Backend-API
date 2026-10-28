require('dotenv').config();
const { Client } = require('pg');

async function prepareTestDatabase() {
  const database = process.env.DB_TEST_NAME || 'backend_api_test';
  if (!/test/i.test(database) || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(database)) {
    throw new Error('DB_TEST_NAME must be a valid PostgreSQL identifier containing "test"');
  }

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined
  });

  await client.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    );

    if (result.rowCount === 0) {
      try {
        await client.query(`CREATE DATABASE "${database}"`);
        console.log(`Created PostgreSQL test database "${database}".`);
      } catch (error) {
        if (error.code !== '42P04') {
          throw error;
        }
      }
    } else {
      console.log(`PostgreSQL test database "${database}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

prepareTestDatabase().catch((error) => {
  console.error('Unable to prepare the integration-test database:', error.message);
  if (error.code === '42501') {
    console.error('The configured PostgreSQL user needs CREATEDB permission.');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('Check that PostgreSQL is running and DB_HOST/DB_PORT are correct.');
  }
  process.exitCode = 1;
});
