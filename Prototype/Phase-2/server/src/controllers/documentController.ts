/**
 * UC-005: Upload Data Room Documents.
 * The founder uploads documents to a private data room. Each file is checked,
 * scanned for malware, encrypted and stored as a new version. Key numbers are
 * extracted from spreadsheets, and the founder confirms any "Verify" values.
 */
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/auditLog';
import {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  getExtension,
  getContentType,
  hasCorrectFormat,
  scanForMalware,
  encryptFile,
  decryptFile,
} from '../utils/fileSecurity';
import { EXTRACTOR_VERSION, extractFromSpreadsheet, ExtractedField } from '../utils/extractFields';

export const DOCUMENT_TYPES = ['Financial statement', 'Incorporation document', 'Contract', 'Cap table'];

// Finds the logged in founder's profile, or throws if they have not started one
async function getProfileId(founderId?: number) {
  const result = await pool.query('SELECT id FROM startup_profiles WHERE founder_id = $1', [founderId]);
  if (result.rows.length === 0) {
    throw new AppError(404, 'Please create your startup profile first');
  }
  return result.rows[0].id as number;
}

// Lists the founder's documents and the values extracted from them
export async function getDocuments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = await getProfileId(req.user?.id);

    const documents = await pool.query(
      `SELECT d.id, d.doc_type, d.file_name, d.file_size, d.version, d.status,
              d.extraction_status, d.uploaded_at, u.full_name AS uploaded_by
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE d.profile_id = $1
       ORDER BY d.uploaded_at DESC`,
      [profileId]
    );

    const fields = await pool.query(
      `SELECT f.id, f.document_id, f.field_name, f.value, f.source, f.confidence, f.status, d.file_name
       FROM extracted_fields f
       JOIN documents d ON d.id = f.document_id
       WHERE d.profile_id = $1
       ORDER BY d.uploaded_at DESC, f.id`,
      [profileId]
    );

    res.json({
      documentTypes: DOCUMENT_TYPES,
      documents: documents.rows,
      // NUMERIC values come back from PostgreSQL as text
      fields: fields.rows.map((f) => ({ ...f, value: Number(f.value), confidence: Number(f.confidence) })),
    });
  } catch (err) {
    next(err);
  }
}

// Handles a new upload: check, scan, encrypt, store, extract and log
export async function uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = await getProfileId(req.user?.id);
    const file = req.file;
    const docType = req.body.docType;

    if (!DOCUMENT_TYPES.includes(docType)) {
      throw new AppError(400, 'Please select a document type');
    }
    if (!file) {
      throw new AppError(400, 'Please choose a file to upload');
    }

    // E1: only PDF, XLSX or DOCX files of at most 25 MB
    const extension = getExtension(file.originalname);
    if (!ALLOWED_TYPES.includes(extension)) {
      throw new AppError(400, 'Only PDF, XLSX or DOCX files can be uploaded');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(400, 'The file is larger than 25 MB');
    }
    if (!hasCorrectFormat(file.buffer, extension)) {
      throw new AppError(400, `This file is not a real ${extension.toUpperCase()} file`);
    }

    const infected = scanForMalware(file.buffer);

    // only spreadsheets that passed the scan are read
    let fields: ExtractedField[] = [];
    let extracted = false;
    if (!infected && extension === 'xlsx') {
      try {
        fields = await extractFromSpreadsheet(file.buffer);
        extracted = true;
      } catch (err) {
        // E3: the file is still stored, just marked "Not yet extracted"
        logger.warn(`Extraction failed for ${file.originalname}: ${(err as Error).message}`);
      }
    }

    // each upload of the same document type is a new version
    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM documents WHERE profile_id = $1 AND doc_type = $2',
      [profileId, docType]
    );
    const version = versionResult.rows[0].next;

    const encrypted = encryptFile(file.buffer);
    const saved = await pool.query(
      `INSERT INTO documents (profile_id, doc_type, file_name, file_size, version, status,
         extraction_status, extractor_version, file_data, iv, auth_tag, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        profileId,
        docType,
        file.originalname,
        file.size,
        version,
        infected ? 'quarantined' : 'stored',
        extracted ? 'extracted' : 'not_extracted',
        extracted ? EXTRACTOR_VERSION : null,
        encrypted.data,
        encrypted.iv,
        encrypted.authTag,
        req.user!.id,
      ]
    );
    const documentId = saved.rows[0].id;

    // E2: malware found, the file is quarantined and only the admin can see it
    if (infected) {
      await logAction(req.user!.id, 'document_quarantined', profileId, `${file.originalname} quarantined (malware found)`);
      logger.warn(`Malware found in ${file.originalname} uploaded by user ${req.user?.id}`);
      throw new AppError(422, 'Malware was found in this file. It has been quarantined and will not be shown to anyone.');
    }

    // values below 0.7 confidence are marked "Verify"
    for (const field of fields) {
      await pool.query(
        `INSERT INTO extracted_fields (document_id, field_name, value, source, confidence, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, field.fieldName, field.value, field.source, field.confidence, field.confidence < 0.7 ? 'verify' : 'accepted']
      );
    }

    await logAction(req.user!.id, 'document_uploaded', profileId, `${docType} uploaded: ${file.originalname} (version ${version})`);
    logger.info(`User ${req.user?.id} uploaded ${file.originalname}`);

    res.status(201).json({
      message: extracted
        ? `${file.originalname} uploaded. ${fields.length} value(s) found.`
        : `${file.originalname} uploaded. Not yet extracted.`,
    });
  } catch (err) {
    next(err);
  }
}

// Sends a stored file back to the founder who owns it
export async function downloadDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = await getProfileId(req.user?.id);
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      throw new AppError(400, 'Invalid document id');
    }

    const result = await pool.query(
      `SELECT file_name, file_data, iv, auth_tag FROM documents
       WHERE id = $1 AND profile_id = $2 AND status = 'stored'`,
      [documentId, profileId]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Document not found');
    }

    const doc = result.rows[0];
    const file = decryptFile(doc.file_data, doc.iv, doc.auth_tag);
    res.setHeader('Content-Type', getContentType(doc.file_name));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(file);
  } catch (err) {
    next(err);
  }
}

// A1: the founder confirms or corrects a "Verify" value
export async function confirmField(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profileId = await getProfileId(req.user?.id);
    const fieldId = Number(req.params.id);
    const value = Number(req.body.value);
    if (!Number.isInteger(fieldId) || fieldId <= 0) {
      throw new AppError(400, 'Invalid field id');
    }
    if (req.body.value === '' || req.body.value === null || !Number.isFinite(value) || value < 0) {
      throw new AppError(400, 'Please enter a valid number (0 or more)');
    }

    // only values from the founder's own documents can be confirmed
    const result = await pool.query(
      `UPDATE extracted_fields f SET value = $1, status = 'confirmed', confirmed_at = NOW()
       FROM documents d
       WHERE f.id = $2 AND f.document_id = d.id AND d.profile_id = $3 AND f.status = 'verify'
       RETURNING f.field_name, d.file_name`,
      [value, fieldId, profileId]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Value not found or already confirmed');
    }

    const { field_name, file_name } = result.rows[0];
    await logAction(req.user!.id, 'field_confirmed', profileId, `${field_name} confirmed as ${value} (${file_name})`);
    res.json({ message: `${field_name} confirmed` });
  } catch (err) {
    next(err);
  }
}

// E2: the administrator sees all quarantined files
export async function getQuarantinedFiles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT d.id, d.doc_type, d.file_name, d.file_size, d.uploaded_at,
              u.full_name AS uploaded_by, p.company_name
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       JOIN startup_profiles p ON p.id = d.profile_id
       WHERE d.status = 'quarantined'
       ORDER BY d.uploaded_at DESC`
    );
    res.json({ files: result.rows });
  } catch (err) {
    next(err);
  }
}
