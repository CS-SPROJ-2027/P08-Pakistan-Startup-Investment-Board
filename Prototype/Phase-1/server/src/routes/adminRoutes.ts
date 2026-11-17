/**
 * Routes for the administrator to review registrations (UC-001).
 * All routes require an admin login.
 */
import express from 'express';
import { getUsers, reviewUser } from '../controllers/adminController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/users', getUsers);
router.post('/users/:id/review', reviewUser);

export default router;
