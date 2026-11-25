/**
 * Routes for investors and incubator managers: shared startups (UC-014)
 * and comparing startups (UC-015).
 */
import express from 'express';
import { getSharedStartups, getStartupDetails } from '../controllers/investorController';
import { compareStartups, saveShortlist, getShortlists } from '../controllers/compareController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('investor', 'incubator'));

router.get('/', getSharedStartups);
// these come before /:id so "compare" is not read as an id
router.get('/compare', compareStartups);
router.get('/shortlists', getShortlists);
router.post('/shortlists', saveShortlist);
router.get('/:id', getStartupDetails);

export default router;
