/**
 * UC-014: Review Shared Startups on Investor Dashboard.
 * Investors and incubator managers only see startups that were shared with
 * their organisation. They see the latest submitted version of each profile.
 * Opening a startup is saved in the audit log.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';

// latest submitted version of every startup shared with the user's organisation
const SHARED_STARTUPS_SQL = `
  SELECT p.id, g.granted_at, v.version_number, v.data, v.created_at AS submitted_at, u.organisation
  FROM access_grants g
  JOIN startup_profiles p ON p.id = g.profile_id
  JOIN profile_versions v ON v.profile_id = p.id
  JOIN users u ON u.id = $1
  WHERE g.revoked_at IS NULL
    AND g.organisation = u.organisation
    AND v.version_number = (SELECT MAX(version_number) FROM profile_versions WHERE profile_id = p.id)
`;

// Lists the shared startups, with optional filters and sorting
export async function getSharedStartups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { sector, stage, city, minRound, maxRound, sort } = req.query;
    if ((minRound && Number.isNaN(Number(minRound))) || (maxRound && Number.isNaN(Number(maxRound)))) {
      throw new AppError(400, 'Round size filters must be numbers');
    }
    const result = await pool.query(SHARED_STARTUPS_SQL, [req.user?.id]);

    let startups = result.rows.map((row) => ({
      id: row.id,
      companyName: row.data.companyName,
      sector: row.data.sector,
      stage: row.data.stage,
      city: row.data.city || '',
      roundAmount: row.data.roundAmount,
      monthlyRevenue: row.data.monthlyRevenue,
      sharedAt: row.granted_at,
    }));
    const total = startups.length;

    // filters
    if (sector) {
      startups = startups.filter((s) => s.sector === sector);
    }
    if (stage) {
      startups = startups.filter((s) => s.stage === stage);
    }
    if (city) {
      startups = startups.filter((s) => s.city === city);
    }
    if (minRound) {
      startups = startups.filter((s) => s.roundAmount >= Number(minRound));
    }
    if (maxRound) {
      startups = startups.filter((s) => s.roundAmount <= Number(maxRound));
    }

    // sorting (fit score sorting comes with UC-013)
    if (sort === 'round_high') {
      startups.sort((a, b) => b.roundAmount - a.roundAmount);
    } else if (sort === 'round_low') {
      startups.sort((a, b) => a.roundAmount - b.roundAmount);
    } else if (sort === 'name') {
      startups.sort((a, b) => a.companyName.localeCompare(b.companyName));
    } else {
      startups.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());
    }

    res.json({ startups, total });
  } catch (err) {
    next(err);
  }
}

// Returns one shared startup and saves the view in the audit log
export async function getStartupDetails(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = Number(req.params.id);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new AppError(400, 'Invalid startup id');
    }

    const result = await pool.query(`${SHARED_STARTUPS_SQL} AND p.id = $2`, [req.user?.id, profileId]);
    const row = result.rows[0];

    // no active grant: either never shared or the founder revoked access
    if (!row) {
      throw new AppError(403, 'You no longer have access to this startup. The founder may have removed your access.');
    }

    await logAction(req.user!.id, 'profile_viewed', profileId, `Profile viewed by ${row.organisation}`);
    logger.info(`User ${req.user?.id} viewed startup ${profileId}`);

    res.json({
      id: row.id,
      version: row.version_number,
      submittedAt: row.submitted_at,
      profile: row.data,
    });
  } catch (err) {
    next(err);
  }
}
