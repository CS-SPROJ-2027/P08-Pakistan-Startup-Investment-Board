/**
 * UC-004: Submit Startup Profile.
 * Founders load and autosave their profile as a draft, then submit it.
 * Submitting checks all mandatory fields, marks it "Ready for review"
 * and saves a new version.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import {
  Profile,
  SECTORS,
  STAGES,
  CITIES,
  INSTRUMENTS,
  getMissingFields,
  getCompleteness,
  getCapTableTotal,
} from '../utils/profileRules';

// Converts a database row into the profile object used by the app
function rowToProfile(row: any): Profile {
  return {
    companyName: row.company_name || '',
    sector: row.sector || '',
    stage: row.stage || '',
    city: row.city || '',
    team: row.team,
    activeCustomers: row.active_customers,
    tractionNotes: row.traction_notes || '',
    revenuePeriod: row.revenue_period || '',
    monthlyRevenue: row.monthly_revenue_pkr,
    capTable: row.cap_table,
    roundAmount: row.round_amount_pkr,
    roundInstrument: row.round_instrument || '',
    useOfFunds: row.use_of_funds || '',
  };
}

// Turns an empty value into null and checks that a number is valid
function toNumber(value: any, label: string): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(400, `${label} must be a number and cannot be negative`);
  }
  return Math.round(number);
}

function toText(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Checks the values sent from the form and returns a clean profile
function cleanProfile(body: any): Profile {
  const profile: Profile = {
    companyName: toText(body.companyName),
    sector: toText(body.sector),
    stage: toText(body.stage),
    city: toText(body.city),
    team: [],
    activeCustomers: toNumber(body.activeCustomers, 'Active customers'),
    tractionNotes: toText(body.tractionNotes),
    revenuePeriod: toText(body.revenuePeriod),
    monthlyRevenue: toNumber(body.monthlyRevenue, 'Monthly revenue'),
    capTable: [],
    roundAmount: toNumber(body.roundAmount, 'Round amount'),
    roundInstrument: toText(body.roundInstrument),
    useOfFunds: toText(body.useOfFunds),
  };

  if (profile.sector && !SECTORS.includes(profile.sector)) {
    throw new AppError(400, 'Please select a valid sector');
  }
  if (profile.stage && !STAGES.includes(profile.stage)) {
    throw new AppError(400, 'Please select a valid stage');
  }
  if (profile.city && !CITIES.includes(profile.city)) {
    throw new AppError(400, 'Please select a valid city');
  }
  if (profile.roundInstrument && !INSTRUMENTS.includes(profile.roundInstrument)) {
    throw new AppError(400, 'Please select a valid round instrument');
  }
  if (profile.revenuePeriod && !/^\d{4}-\d{2}$/.test(profile.revenuePeriod)) {
    throw new AppError(400, 'Revenue period must be a month like 2026-10');
  }

  if (Array.isArray(body.team)) {
    profile.team = body.team.slice(0, 20).map((member: any) => ({
      name: toText(member.name),
      role: toText(member.role),
    }));
  }

  if (Array.isArray(body.capTable)) {
    profile.capTable = body.capTable.slice(0, 50).map((row: any) => {
      // an empty box is kept as null
      const percentage = row.percentage === null || row.percentage === '' ? null : Number(row.percentage);
      if (percentage !== null && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
        throw new AppError(400, 'Each cap table percentage must be between 0 and 100');
      }
      return { holder: toText(row.holder), percentage };
    });
  }

  return profile;
}

// Adds completeness, missing fields and the cap table warning for the page
async function buildResponse(row: any) {
  const profile = rowToProfile(row);
  const capTableTotal = getCapTableTotal(profile.capTable);

  const versions = await pool.query(
    'SELECT MAX(version_number) AS latest FROM profile_versions WHERE profile_id = $1',
    [row.id]
  );

  return {
    profile,
    status: row.status,
    completeness: getCompleteness(profile),
    missingFields: getMissingFields(profile),
    capTableTotal,
    capTableWarning:
      profile.capTable.length > 0 && capTableTotal !== 100
        ? `Cap table adds up to ${capTableTotal}%, it should be 100%`
        : null,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    latestVersion: versions.rows[0].latest,
  };
}

export async function getMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let result = await pool.query('SELECT * FROM startup_profiles WHERE founder_id = $1', [req.user?.id]);

    // first visit: create an empty draft with the company name from registration
    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO startup_profiles (founder_id, company_name)
         SELECT id, organisation FROM users WHERE id = $1
         RETURNING *`,
        [req.user?.id]
      );
    }

    res.json(await buildResponse(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

export async function saveDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = cleanProfile(req.body);
    const completeness = getCompleteness(profile);

    // any change after submitting puts the profile back to draft until it is submitted again
    const result = await pool.query(
      `UPDATE startup_profiles SET
         company_name = $1, sector = $2, stage = $3, team = $4, active_customers = $5,
         traction_notes = $6, revenue_period = $7, monthly_revenue_pkr = $8, cap_table = $9,
         round_amount_pkr = $10, round_instrument = $11, use_of_funds = $12,
         completeness = $13, city = $14, status = 'draft', updated_at = NOW()
       WHERE founder_id = $15
       RETURNING *`,
      [
        profile.companyName,
        profile.sector || null,
        profile.stage || null,
        JSON.stringify(profile.team),
        profile.activeCustomers,
        profile.tractionNotes,
        profile.revenuePeriod || null,
        profile.monthlyRevenue,
        JSON.stringify(profile.capTable),
        profile.roundAmount,
        profile.roundInstrument || null,
        profile.useOfFunds,
        completeness,
        profile.city || null,
        req.user?.id,
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Profile not found. Please reload the page');
    }

    res.json(await buildResponse(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

export async function submitProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query('SELECT * FROM startup_profiles WHERE founder_id = $1', [req.user?.id]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, 'Profile not found. Please reload the page');
    }

    if (row.status === 'ready_for_review') {
      throw new AppError(409, 'This profile is already submitted. Make a change first to submit a new version');
    }

    const profile = rowToProfile(row);
    const missingFields = getMissingFields(profile);
    if (missingFields.length > 0) {
      throw new AppError(400, 'Please fill in all mandatory fields before submitting', { missingFields });
    }

    const versions = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM profile_versions WHERE profile_id = $1',
      [row.id]
    );
    const versionNumber = versions.rows[0].next;

    await pool.query('INSERT INTO profile_versions (profile_id, version_number, data) VALUES ($1, $2, $3)', [
      row.id,
      versionNumber,
      JSON.stringify(profile),
    ]);
    const updated = await pool.query(
      `UPDATE startup_profiles SET status = 'ready_for_review', completeness = 100, submitted_at = NOW()
       WHERE id = $1 RETURNING *`,
      [row.id]
    );

    logger.info(`Founder ${req.user?.id} submitted profile version ${versionNumber}`);
    res.json({ ...(await buildResponse(updated.rows[0])), message: `Profile submitted (version ${versionNumber})` });
  } catch (err) {
    next(err);
  }
}
