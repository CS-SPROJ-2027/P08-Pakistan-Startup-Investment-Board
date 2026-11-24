/**
 * Routes for the founder's data room (UC-005).
 */
import express from 'express';
import multer from 'multer';
import { getDocuments, uploadDocument, downloadDocument, confirmField } from '../controllers/documentController';
import { verifyToken, requireRole } from '../middleware/auth';
import { MAX_FILE_SIZE } from '../utils/fileSecurity';

const router = express.Router();

// keeps the uploaded file in memory so it can be scanned and encrypted before saving
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

router.use(verifyToken, requireRole('founder'));

router.get('/', getDocuments);
router.post('/', upload.single('file'), uploadDocument);
router.get('/:id/download', downloadDocument);
router.post('/fields/:id/confirm', confirmField);

export default router;
