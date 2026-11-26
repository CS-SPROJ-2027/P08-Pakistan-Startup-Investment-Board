/**
 * UC-016: Generate Diligence Memo.
 * An investor or incubator manager opens a one-page memo of a shared startup.
 * Numbers and red flags come from code (memoRules), the summary is written by a
 * local AI model or by rules (narrative), and every claim links to its source.
 * The evidence endpoint shows the spreadsheet a claim came from.
 */
import { Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';
import { SHARED_STARTUPS_SQL } from './investorController';
import { getLatestReport } from './readinessController';
import { buildMemo } from '../utils/memoRules';
import { writeNarrative } from '../utils/narrative';
import { decryptFile, getExtension } from '../utils/fileSecurity';

// Checks the startup is shared with the user's organisation and returns its latest submitted version
async function getSharedStartup(userId: number, profileId: number) {
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new AppError(400, 'Invalid startup id');
  }
  const result = await pool.query(SHARED_STARTUPS_SQL, [userId]);
  const row = result.rows.find((r) => r.id === profileId);
  if (!row) {
    throw new AppError(403, 'You no longer have access to this startup. The founder may have removed your access.');
  }
  return row;
}

// Returns the memo, or writes a new one if the profile or data room changed (or ?refresh=1)
export async function getMemo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = Number(req.params.id);
    const row = await getSharedStartup(req.user!.id, profileId);

    // data room version goes up by one with every file stored
    const documents = await pool.query(
      `SELECT id, doc_type, file_name FROM documents WHERE profile_id = $1 AND status = 'stored'`,
      [profileId]
    );
    const dataRoomVersion = documents.rows.length;

    let memo = null;
    if (req.query.refresh !== '1') {
      const saved = await pool.query(
        `SELECT * FROM memos WHERE profile_id = $1 AND profile_version = $2 AND data_room_version = $3
         ORDER BY created_at DESC LIMIT 1`,
        [profileId, row.version_number, dataRoomVersion]
      );
      memo = saved.rows[0] || null;
    }

    if (!memo) {
      // extracted values of the newest financial statement that has any
      const fields = await pool.query(
        `SELECT f.field_name, f.value, f.source, f.status, f.series, f.document_id, d.file_name
         FROM extracted_fields f
         JOIN documents d ON d.id = f.document_id
         WHERE d.id = (SELECT MAX(d2.id) FROM documents d2 JOIN extracted_fields f2 ON f2.document_id = d2.id
                       WHERE d2.profile_id = $1 AND d2.status = 'stored' AND d2.doc_type = 'Financial statement')`,
        [profileId]
      );
      const report = await getLatestReport(profileId);

      const content = buildMemo({
        profile: row.data,
        profileVersion: row.version_number,
        documents: documents.rows,
        statement: fields.rows.map((f) => ({ ...f, value: Number(f.value) })),
        flags: report ? report.flags : null,
      });
      const narrative = await writeNarrative(row.data, content);

      const saved = await pool.query(
        `INSERT INTO memos (profile_id, profile_version, data_room_version, content, narrative_method, model)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [profileId, row.version_number, dataRoomVersion, JSON.stringify({ ...content, narrative: narrative.text }), narrative.method, narrative.model]
      );
      memo = saved.rows[0];
      logger.info(`Memo written for profile ${profileId} (${narrative.method})`);
    }

    await logAction(req.user!.id, 'memo_viewed', profileId, `Diligence memo viewed by ${row.organisation}`);

    res.json({
      companyName: row.data.companyName,
      createdAt: memo.created_at,
      profileVersion: memo.profile_version,
      dataRoomVersion: memo.data_room_version,
      method: memo.narrative_method,
      model: memo.model,
      ...memo.content,
    });
  } catch (err) {
    next(err);
  }
}

// Text shown for one spreadsheet cell
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((t) => t.text).join('');
  return String(value);
}

// A1: sends the sheets of a data room spreadsheet so the page can show the source cell
export async function getEvidence(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = Number(req.params.id);
    const documentId = Number(req.params.documentId);
    await getSharedStartup(req.user!.id, profileId);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      throw new AppError(400, 'Invalid document id');
    }

    const result = await pool.query(
      `SELECT file_name, file_data, iv, auth_tag FROM documents WHERE id = $1 AND profile_id = $2 AND status = 'stored'`,
      [documentId, profileId]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Document not found');
    }
    const doc = result.rows[0];
    if (getExtension(doc.file_name) !== 'xlsx') {
      throw new AppError(400, 'Only spreadsheets can be shown here');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(decryptFile(doc.file_data, doc.iv, doc.auth_tag) as any);

    // first 100 rows and 26 columns of each sheet is enough for a statement
    const sheets: { name: string; rows: string[][] }[] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[][] = [];
      for (let r = 1; r <= Math.min(sheet.rowCount, 100); r++) {
        const cells: string[] = [];
        for (let c = 1; c <= Math.min(sheet.columnCount, 26); c++) {
          cells.push(cellText(sheet.getRow(r).getCell(c).value));
        }
        rows.push(cells);
      }
      sheets.push({ name: sheet.name, rows });
    });

    res.json({ fileName: doc.file_name, sheets });
  } catch (err) {
    next(err);
  }
}
