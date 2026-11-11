/**
 * Express app setup.
 * Registers middleware and API routes. Kept separate from index.ts
 * so the app can be started on its own or reused.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import pool from './config/db';
import { notFound, errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import profileRoutes from './routes/profileRoutes';

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
app.use('/api/profile', profileRoutes);

app.use('/api', notFound);

// In production the built React app is served from client/dist
// (the server is started from the server folder, so client is one level up)
const clientDist = path.join(process.cwd(), '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(errorHandler);

export default app;
