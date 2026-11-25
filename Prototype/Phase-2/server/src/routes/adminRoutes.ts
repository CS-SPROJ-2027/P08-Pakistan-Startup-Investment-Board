/**
 * Routes for the administrator: review registrations (UC-001)
 * see quarantined files (UC-005) and review disputed ratings (UC-006).
 * All routes require an admin login.
 */
import express from 'express';
import { getUsers, reviewUser } from '../controllers/adminController';
import { getQuarantinedFiles } from '../controllers/documentController';
import { getDisputes, reviewDispute } from '../controllers/readinessController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/users', getUsers);
router.post('/users/:id/review', reviewUser);
router.get('/quarantine', getQuarantinedFiles);
router.get('/disputes', getDisputes);
router.post('/disputes/:id/review', reviewDispute);

export default router;
