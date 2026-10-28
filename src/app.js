const express = require('express');
const path = require('node:path');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { failure } = require('./utils/response');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/users', userRoutes);

app.use((req, res) => failure(res, 404, 'ROUTE_ERR_NOT_FOUND', 'Route not found'));
app.use(errorHandler);

module.exports = app;
