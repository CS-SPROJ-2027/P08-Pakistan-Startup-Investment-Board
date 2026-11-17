/**
 * Routes for investors and incubator managers to see shared startups (UC-014).
 */
import express from 'express';
import { getSharedStartups, getStartupDetails } from '../controllers/investorController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('investor', 'incubator'));

router.get('/', getSharedStartups);
router.get('/:id', getStartupDetails);

export default router;
