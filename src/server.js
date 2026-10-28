require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/database');
const { getJwtSecrets } = require('./config/env');

async function startServer() {
  getJwtSecrets();
  await sequelize.authenticate();

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`Backend API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Unable to start the API:', error.message);
  process.exitCode = 1;
});
