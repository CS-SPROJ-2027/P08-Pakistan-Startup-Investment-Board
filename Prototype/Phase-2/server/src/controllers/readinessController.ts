/**
 * UC-006: Run Readiness and Consistency Check.
 * The founder runs a check on their latest profile and data room documents.
 * The report (ratings, flags, rubric version) is stored and logged.
 * The founder can explain a flag or dispute a rating, and the administrator
 * can override a disputed rating with a reason.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';
import { rowToProfile } from './profileController';
import { RUBRIC_VERSION, buildReport, describeRating, Rating, Flag, StatementValue } from '../utils/readinessRules';

// Finds the logged in founder's profile row, or throws if they have not started one
async function getProfileRow(founderId?: number) {
  const result = await pool.query('SELECT * FROM startup_profiles WHERE founder_id = $1', [founderId]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'Please create your startup profile first');
  }
  return result.rows[0];
}

// Finds a report and checks it belongs to the founder's profile
async function getOwnReport(reportId: number, profileId: number) {
  if (!Number.isInteger(reportId) || reportId <= 0) {
    throw new AppError(400, 'Invalid report id');
  }
  const result = await pool.query('SELECT * FROM readiness_reports WHERE id = $1 AND profile_id = $2', [
    reportId,
    profileId,
  ]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'Report not found');
  }
  return result.rows[0];
}

// Shapes a report row for the client
function formatReport(row: any) {
  return {
    id: row.id,
    rubricVersion: row.rubric_version,
    documentsChecked: row.documents_checked,
    ratings: row.ratings,
    flags: row.flags,
    createdAt: row.created_at,
  };
}

// Latest report for a profile, or null (also used on the investor details page)
export async function getLatestReport(profileId: number) {
  const result = await pool.query(
    'SELECT * FROM readiness_reports WHERE profile_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [profileId]
  );
  return result.rows.length > 0 ? formatReport(result.rows[0]) : null;
}

// Returns the founder's latest report and any disputes on it
export async function getMyReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getProfileRow(req.user?.id);
    const report = await getLatestReport(profile.id);

    let disputes = [];
    if (report) {
      const result = await pool.query(
        `SELECT id, category, reason, status, new_rating, admin_reason, created_at
         FROM rating_disputes WHERE report_id = $1 ORDER BY created_at DESC`,
        [report.id]
      );
      disputes = result.rows;
    }
    res.json({ report, disputes });
  } catch (err) {
    next(err);
  }
}

// Runs all checks and stores a new report
export async function runCheck(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await getProfileRow(req.user?.id);

    // documents that passed the malware scan (quarantined files are ignored)
    const documents = await pool.query(
      `SELECT doc_type, file_name, extraction_status FROM documents
       WHERE profile_id = $1 AND status = 'stored'`,
      [row.id]
    );

    // values from the newest financial statement that has any extracted values
    const fields = await pool.query(
      `SELECT f.field_name, f.value, f.source, f.status, d.file_name
       FROM extracted_fields f
       JOIN documents d ON d.id = f.document_id
       WHERE d.profile_id = $1 AND d.status = 'stored' AND d.doc_type = 'Financial statement'
         AND d.id = (SELECT MAX(d2.id) FROM documents d2 JOIN extracted_fields f2 ON f2.document_id = d2.id
                     WHERE d2.profile_id = $1 AND d2.status = 'stored' AND d2.doc_type = 'Financial statement')`,
      [row.id]
    );
    const statement: Record<string, StatementValue> = {};
    for (const f of fields.rows) {
      statement[f.field_name] = { value: Number(f.value), source: `${f.file_name}, ${f.source}`, status: f.status };
    }

    const result = buildReport(rowToProfile(row), row.status, documents.rows, statement);

    const saved = await pool.query(
      `INSERT INTO readiness_reports (profile_id, rubric_version, documents_checked, ratings, flags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [row.id, RUBRIC_VERSION, result.documentsChecked, JSON.stringify(result.ratings), JSON.stringify(result.flags), req.user!.id]
    );
    await logAction(
      req.user!.id,
      'readiness_report_created',
      row.id,
      `Readiness report created (rubric ${RUBRIC_VERSION}, ${result.flags.length} flag(s))`
    );

    logger.info(`Readiness report created for profile ${row.id}`);
    res.status(201).json({ message: 'Readiness report created', report: formatReport(saved.rows[0]) });
  } catch (err) {
    next(err);
  }
}

// A1: the founder adds an explanation to a flag; investors see it with the flag
export async function explainFlag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getProfileRow(req.user?.id);
    const report = await getOwnReport(Number(req.params.id), profile.id);
    const index = Number(req.params.index);
    const explanation = typeof req.body.explanation === 'string' ? req.body.explanation.trim() : '';

    const flags: Flag[] = report.flags;
    if (!Number.isInteger(index) || index < 0 || index >= flags.length) {
      throw new AppError(404, 'Flag not found');
    }
    if (explanation.length < 5 || explanation.length > 300) {
      throw new AppError(400, 'Explanation must be between 5 and 300 characters');
    }

    flags[index].explanation = explanation;
    await pool.query('UPDATE readiness_reports SET flags = $1 WHERE id = $2', [JSON.stringify(flags), report.id]);
    await logAction(req.user!.id, 'flag_explained', profile.id, `Explanation added to flag: ${flags[index].message}`);

    res.json({ message: 'Explanation saved' });
  } catch (err) {
    next(err);
  }
}

// A2: the founder disputes a rating; it goes to the administrator
export async function disputeRating(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getProfileRow(req.user?.id);
    const report = await getOwnReport(Number(req.params.id), profile.id);
    const category = req.body.category;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    const rating = (report.ratings as Rating[]).find((r) => r.category === category);
    if (!rating) {
      throw new AppError(404, 'Category not found in this report');
    }
    if (rating.rating === null) {
      throw new AppError(400, 'A category that is "Not assessed" cannot be disputed');
    }
    if (reason.length < 10 || reason.length > 500) {
      throw new AppError(400, 'Please explain why you disagree (10 to 500 characters)');
    }

    const existing = await pool.query(
      `SELECT id FROM rating_disputes WHERE report_id = $1 AND category = $2 AND status = 'pending'`,
      [report.id, category]
    );
    if (existing.rows.length > 0) {
      throw new AppError(409, 'This rating is already waiting for the administrator');
    }

    await pool.query('INSERT INTO rating_disputes (report_id, category, reason) VALUES ($1, $2, $3)', [
      report.id,
      category,
      reason,
    ]);
    await logAction(req.user!.id, 'rating_disputed', profile.id, `${category} rating (${rating.rating}/5) disputed`);

    res.status(201).json({ message: 'Dispute sent to the administrator' });
  } catch (err) {
    next(err);
  }
}

// Admin: lists disputes waiting for a decision
export async function getDisputes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT d.id, d.category, d.reason, d.created_at, r.ratings, p.company_name
       FROM rating_disputes d
       JOIN readiness_reports r ON r.id = d.report_id
       JOIN startup_profiles p ON p.id = r.profile_id
       WHERE d.status = 'pending'
       ORDER BY d.created_at`
    );

    // send only the disputed category, not the whole report
    const disputes = result.rows.map((row) => {
      const rating = (row.ratings as Rating[]).find((r) => r.category === row.category);
      return {
        id: row.id,
        companyName: row.company_name,
        category: row.category,
        currentRating: rating ? rating.rating : null,
        met: rating ? rating.met : [],
        missing: rating ? rating.missing : [],
        reason: row.reason,
        createdAt: row.created_at,
      };
    });
    res.json({ disputes });
  } catch (err) {
    next(err);
  }
}

// Admin: overrides a disputed rating or keeps it. The reason is written to the audit log
export async function reviewDispute(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const disputeId = Number(req.params.id);
    const { action } = req.body;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    const newRating = Number(req.body.newRating);

    if (!Number.isInteger(disputeId) || disputeId <= 0) {
      throw new AppError(400, 'Invalid dispute id');
    }
    if (action !== 'override' && action !== 'keep') {
      throw new AppError(400, 'Action must be override or keep');
    }
    if (reason.length < 5) {
      throw new AppError(400, 'Please give a reason (at least 5 characters)');
    }
    if (action === 'override' && (req.body.newRating === '' || !Number.isInteger(newRating) || newRating < 0 || newRating > 5)) {
      throw new AppError(400, 'New rating must be a whole number from 0 to 5');
    }

    const found = await pool.query(
      `SELECT d.*, r.ratings, r.profile_id FROM rating_disputes d
       JOIN readiness_reports r ON r.id = d.report_id
       WHERE d.id = $1`,
      [disputeId]
    );
    if (found.rows.length === 0) {
      throw new AppError(404, 'Dispute not found');
    }
    const dispute = found.rows[0];
    if (dispute.status !== 'pending') {
      throw new AppError(409, 'This dispute has already been reviewed');
    }

    const ratings: Rating[] = dispute.ratings;
    const rating = ratings.find((r) => r.category === dispute.category)!;
    const oldRating = rating.rating;

    if (action === 'override') {
      rating.overriddenFrom = oldRating;
      rating.overrideReason = reason;
      rating.rating = newRating;
      rating.description = describeRating(newRating);
      await pool.query('UPDATE readiness_reports SET ratings = $1 WHERE id = $2', [JSON.stringify(ratings), dispute.report_id]);
    }

    await pool.query(
      `UPDATE rating_disputes SET status = $1, new_rating = $2, admin_reason = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $5`,
      [action === 'override' ? 'overridden' : 'kept', action === 'override' ? newRating : null, reason, req.user!.id, disputeId]
    );

    const details =
      action === 'override'
        ? `${dispute.category} rating changed from ${oldRating} to ${newRating} by admin. Reason: ${reason}`
        : `${dispute.category} rating kept at ${oldRating} by admin. Reason: ${reason}`;
    await logAction(req.user!.id, action === 'override' ? 'rating_overridden' : 'dispute_kept', dispute.profile_id, details.slice(0, 300));

    logger.info(`Admin ${req.user?.id} reviewed dispute ${disputeId}: ${action}`);
    res.json({ message: action === 'override' ? 'Rating overridden' : 'Rating kept' });
  } catch (err) {
    next(err);
  }
}
