/**
 * Express app setup.
 * Registers middleware and API routes. Kept separate from index.js
 * so the app can be started on its own or reused.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Health check: confirms the server and database are both up
app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', notFound);

// In production the built React app is served from client/dist
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(errorHandler);

module.exports = app;
