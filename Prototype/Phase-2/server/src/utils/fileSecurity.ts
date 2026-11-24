/**
 * File checks, malware scan and encryption for data room uploads (UC-005).
 */
import crypto from 'crypto';

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_TYPES = ['pdf', 'xlsx', 'docx'];

// Returns the file extension in lower case, e.g. "report.PDF" -> "pdf"
export function getExtension(fileName: string) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Content type used when the founder downloads a file
export function getContentType(fileName: string) {
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[getExtension(fileName)] || 'application/octet-stream';
}

// Checks that the file really is the type its name says.
// PDF files start with "%PDF", XLSX and DOCX files are zip files that start with "PK"
export function hasCorrectFormat(buffer: Buffer, extension: string) {
  const start = buffer.subarray(0, 4).toString('latin1');
  if (extension === 'pdf') {
    return start === '%PDF';
  }
  return start.startsWith('PK');
}

// Simple malware scan for the prototype.
// It looks for the EICAR test signature, which every antivirus treats as a virus.
// In a real deployment this would call a scanner such as ClamAV.
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export function scanForMalware(buffer: Buffer) {
  return buffer.includes(EICAR);
}

// Key for AES-256 encryption. FILE_SECRET can be set in .env, otherwise JWT_SECRET is used
function getKey() {
  const secret = process.env.FILE_SECRET || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(secret).digest();
}

// Encrypts a file before it is saved in the database
export function encryptFile(buffer: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { data, iv, authTag: cipher.getAuthTag() };
}

// Decrypts a file so the founder can download it
export function decryptFile(data: Buffer, iv: Buffer, authTag: Buffer) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
