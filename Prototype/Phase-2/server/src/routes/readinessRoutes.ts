/**
 * Routes for the founder's readiness report (UC-006).
 */
import express from 'express';
import { getMyReport, runCheck, explainFlag, disputeRating } from '../controllers/readinessController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('founder'));

router.get('/', getMyReport);
router.post('/', runCheck);
router.post('/:id/flags/:index/explain', explainFlag);
router.post('/:id/dispute', disputeRating);

export default router;
