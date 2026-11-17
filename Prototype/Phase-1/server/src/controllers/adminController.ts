/**
 * UC-001: Register and Verify Account (administrator side).
 * Lets the administrator see registrations and approve or reject them.
 * Each decision is saved with the admin's id and the time, and written to the log.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const STATUSES = ['pending', 'approved', 'rejected'];

// Lists accounts with the given status (pending by default)
export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const status = (req.query.status as string) || 'pending';
    if (!STATUSES.includes(status)) {
      throw new AppError(400, 'Invalid status filter');
    }

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.organisation, u.status,
              u.rejection_reason, u.created_at, u.reviewed_at, a.full_name AS reviewed_by_name
       FROM users u
       LEFT JOIN users a ON a.id = u.reviewed_by
       WHERE u.status = $1 AND u.role <> 'admin'
       ORDER BY u.created_at DESC`,
      [status]
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
}

// Approves or rejects a pending account
export async function reviewUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.params.id);
    const { decision, reason } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(400, 'Invalid user id');
    }
    if (decision !== 'approve' && decision !== 'reject') {
      throw new AppError(400, 'Decision must be approve or reject');
    }
    if (decision === 'reject' && (!reason || reason.trim().length < 5)) {
      throw new AppError(400, 'Please give a reason for rejecting (at least 5 characters)');
    }

    const result = await pool.query('SELECT id, email, status FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      throw new AppError(404, 'User not found');
    }
    if (user.status !== 'pending') {
      throw new AppError(409, `This account has already been ${user.status}`);
    }

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    await pool.query(
      `UPDATE users
       SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [newStatus, decision === 'reject' ? reason.trim() : null, req.user?.id, userId]
    );

    logger.info(`Admin ${req.user?.id} ${newStatus} account ${user.email}`);
    res.json({ message: `Account ${newStatus}` });
  } catch (err) {
    next(err);
  }
}
