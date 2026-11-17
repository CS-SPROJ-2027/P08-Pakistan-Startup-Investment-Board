/**
 * Routes for founders to manage who can see their startup (UC-010).
 */
import express from 'express';
import { getAccessPage, grantAccess, revokeAccess } from '../controllers/accessController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('founder'));

router.get('/', getAccessPage);
router.post('/', grantAccess);
router.post('/:id/revoke', revokeAccess);

export default router;
