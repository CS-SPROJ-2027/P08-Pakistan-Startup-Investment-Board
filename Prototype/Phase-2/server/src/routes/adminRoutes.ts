/**
 * Routes for the administrator: review registrations (UC-001)
 * and see quarantined files (UC-005).
 * All routes require an admin login.
 */
import express from 'express';
import { getUsers, reviewUser } from '../controllers/adminController';
import { getQuarantinedFiles } from '../controllers/documentController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/users', getUsers);
router.post('/users/:id/review', reviewUser);
router.get('/quarantine', getQuarantinedFiles);

export default router;
