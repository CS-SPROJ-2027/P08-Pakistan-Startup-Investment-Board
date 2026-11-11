/**
 * UC-010: Manage Consent and Data Room Access.
 * The founder shares their startup with investor or incubator organisations
 * and can revoke access at any time. Every grant and revoke is logged.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';

// Finds the logged in founder's profile, or throws if they have not started one
async function getFounderProfile(founderId?: number) {
  const result = await pool.query('SELECT id, company_name, status FROM startup_profiles WHERE founder_id = $1', [
    founderId,
  ]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'Please create your startup profile first');
  }
  return result.rows[0];
}

export async function getAccessPage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getFounderProfile(req.user?.id);

    const grants = await pool.query(
      `SELECT id, organisation, organisation_type, granted_at
       FROM access_grants
       WHERE profile_id = $1 AND revoked_at IS NULL
       ORDER BY granted_at DESC`,
      [profile.id]
    );

    // organisations of approved investors and incubator managers
    const organisations = await pool.query(
      `SELECT DISTINCT organisation, role AS organisation_type
       FROM users
       WHERE status = 'approved' AND role IN ('investor', 'incubator')
       ORDER BY organisation`
    );

    const activity = await pool.query(
      `SELECT a.id, a.action, a.details, a.created_at, u.full_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.profile_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [profile.id]
    );

    const versions = await pool.query(
      'SELECT MAX(version_number) AS latest FROM profile_versions WHERE profile_id = $1',
      [profile.id]
    );

    res.json({
      status: profile.status,
      latestVersion: versions.rows[0].latest,
      grants: grants.rows,
      organisations: organisations.rows,
      activity: activity.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function grantAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getFounderProfile(req.user?.id);
    const organisation = typeof req.body.organisation === 'string' ? req.body.organisation.trim() : '';

    if (profile.status !== 'ready_for_review') {
      throw new AppError(400, 'Your profile must be submitted and "Ready for review" before you can share it');
    }
    if (!organisation) {
      throw new AppError(400, 'Please select an organisation');
    }

    // the organisation must belong to at least one approved investor or incubator
    const found = await pool.query(
      `SELECT role FROM users
       WHERE organisation = $1 AND status = 'approved' AND role IN ('investor', 'incubator')
       LIMIT 1`,
      [organisation]
    );
    if (found.rows.length === 0) {
      throw new AppError(404, 'This organisation is not registered on PSIB');
    }

    const existing = await pool.query(
      'SELECT id FROM access_grants WHERE profile_id = $1 AND organisation = $2 AND revoked_at IS NULL',
      [profile.id, organisation]
    );
    if (existing.rows.length > 0) {
      throw new AppError(409, `${organisation} already has access`);
    }

    await pool.query(
      'INSERT INTO access_grants (profile_id, organisation, organisation_type) VALUES ($1, $2, $3)',
      [profile.id, organisation, found.rows[0].role]
    );
    await logAction(req.user!.id, 'access_granted', profile.id, `Access given to ${organisation}`);

    logger.info(`Founder ${req.user?.id} gave access to ${organisation}`);
    res.status(201).json({ message: `Access given to ${organisation}` });
  } catch (err) {
    next(err);
  }
}

export async function revokeAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getFounderProfile(req.user?.id);
    const grantId = Number(req.params.id);
    if (!Number.isInteger(grantId) || grantId <= 0) {
      throw new AppError(400, 'Invalid grant id');
    }

    // only grants on the founder's own profile can be revoked
    const result = await pool.query(
      `UPDATE access_grants SET revoked_at = NOW()
       WHERE id = $1 AND profile_id = $2 AND revoked_at IS NULL
       RETURNING organisation`,
      [grantId, profile.id]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Access grant not found or already revoked');
    }

    const organisation = result.rows[0].organisation;
    await logAction(req.user!.id, 'access_revoked', profile.id, `Access removed from ${organisation}`);

    logger.info(`Founder ${req.user?.id} removed access from ${organisation}`);
    res.json({ message: `Access removed from ${organisation}` });
  } catch (err) {
    next(err);
  }
}
