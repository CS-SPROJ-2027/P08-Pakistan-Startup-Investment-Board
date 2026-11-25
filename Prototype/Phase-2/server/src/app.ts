/**
 * Express app setup.
 * Registers middleware and API routes. Kept separate from index.ts
 * so the app can be started on its own or reused.
 */
import express from 'express';
import cors from 'cors';
import pool from './config/db';
import { notFound, errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import profileRoutes from './routes/profileRoutes';
import accessRoutes from './routes/accessRoutes';
import investorRoutes from './routes/investorRoutes';
import documentRoutes from './routes/documentRoutes';
import readinessRoutes from './routes/readinessRoutes';

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
app.use('/api/access', accessRoutes);
app.use('/api/startups', investorRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/readiness', readinessRoutes);

app.use('/api', notFound);

app.use(errorHandler);

export default app;
