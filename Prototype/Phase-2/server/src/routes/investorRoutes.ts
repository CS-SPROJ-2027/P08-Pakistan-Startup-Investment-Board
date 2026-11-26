/**
 * Routes for investors and incubator managers: shared startups (UC-014),
 * comparing startups (UC-015) and the diligence memo (UC-016).
 */
import express from 'express';
import { getSharedStartups, getStartupDetails } from '../controllers/investorController';
import { compareStartups, saveShortlist, getShortlists } from '../controllers/compareController';
import { getMemo, getEvidence } from '../controllers/memoController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('investor', 'incubator'));

router.get('/', getSharedStartups);
// these come before /:id so "compare" is not read as an id
router.get('/compare', compareStartups);
router.get('/shortlists', getShortlists);
router.post('/shortlists', saveShortlist);
router.get('/:id', getStartupDetails);
router.get('/:id/memo', getMemo);
router.get('/:id/documents/:documentId', getEvidence);

export default router;
