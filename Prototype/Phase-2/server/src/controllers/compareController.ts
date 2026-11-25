/**
 * UC-015: Compare Startups Side by Side.
 * An investor or incubator manager compares 2 to 4 startups shared with their
 * organisation on the same metrics, and can save the comparison to the
 * organisation's shortlist.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';
import { SHARED_STARTUPS_SQL } from './investorController';
import { getLatestReport } from './readinessController';
import { Flag } from '../utils/readinessRules';

// Turns "3,7,9" or [3, 7, 9] into a list of unique ids
function parseIds(value: unknown) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = parts.map((part) => Number(part)).filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

// E2: checks there are 2 to 4 startups and that all of them are shared with the user's organisation
async function getSharedRows(userId: number, ids: number[]) {
  if (ids.length < 2 || ids.length > 4) {
    throw new AppError(400, 'Please select 2 to 4 startups to compare');
  }
  const result = await pool.query(SHARED_STARTUPS_SQL, [userId]);
  const rows = ids.map((id) => result.rows.find((row) => row.id === id));
  if (rows.some((row) => !row)) {
    throw new AppError(403, 'One or more of these startups are no longer shared with your organisation');
  }
  return rows;
}

// Returns the same metrics for each selected startup
export async function compareStartups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await getSharedRows(req.user!.id, parseIds(req.query.ids));

    const startups = [];
    for (const row of rows) {
      const data = row.data;
      const report = await getLatestReport(row.id);
      const teamSize = data.team.filter((member: { name: string }) => member.name.trim() !== '').length;

      // E1: missing values are sent as null, the page shows them as "Not provided"
      startups.push({
        id: row.id,
        companyName: data.companyName,
        sector: data.sector || null,
        stage: data.stage || null,
        city: data.city || null,
        teamSize: teamSize > 0 ? teamSize : null,
        activeCustomers: data.activeCustomers,
        monthlyRevenue: data.monthlyRevenue,
        revenuePeriod: data.revenuePeriod || null,
        roundAmount: data.roundAmount,
        roundInstrument: data.roundInstrument || null,
        ratings: report ? report.ratings : null,
        // open flags are the ones the founder has not explained yet
        openFlags: report ? report.flags.filter((flag: Flag) => !flag.explanation).length : null,
      });
    }

    res.json({ startups });
  } catch (err) {
    next(err);
  }
}

// Saves the comparison to the organisation's shortlist
export async function saveShortlist(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 3 || name.length > 100) {
      throw new AppError(400, 'Shortlist name must be between 3 and 100 characters');
    }
    const rows = await getSharedRows(req.user!.id, parseIds(req.body.ids));
    const organisation = rows[0].organisation;

    await pool.query('INSERT INTO shortlists (organisation, name, profile_ids, created_by) VALUES ($1, $2, $3, $4)', [
      organisation,
      name,
      JSON.stringify(rows.map((row) => row.id)),
      req.user!.id,
    ]);

    // one log entry per startup, so each founder can see it was shortlisted
    for (const row of rows) {
      await logAction(req.user!.id, 'shortlisted', row.id, `Added to ${organisation} shortlist "${name}"`);
    }

    logger.info(`User ${req.user?.id} saved shortlist "${name}"`);
    res.status(201).json({ message: `Saved to shortlist "${name}"` });
  } catch (err) {
    next(err);
  }
}

// Lists the shortlists saved by anyone in the user's organisation
export async function getShortlists(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.profile_ids, s.created_at, u.full_name AS created_by
       FROM shortlists s
       JOIN users u ON u.id = s.created_by
       JOIN users me ON me.id = $1
       WHERE s.organisation = me.organisation
       ORDER BY s.created_at DESC`,
      [req.user!.id]
    );

    // company names of startups that are still shared
    const shared = await pool.query(SHARED_STARTUPS_SQL, [req.user!.id]);
    const names: Record<number, string> = {};
    for (const row of shared.rows) {
      names[row.id] = row.data.companyName;
    }

    const shortlists = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      ids: row.profile_ids,
      companies: (row.profile_ids as number[]).map((id) => names[id] || 'No longer shared'),
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
    res.json({ shortlists });
  } catch (err) {
    next(err);
  }
}
