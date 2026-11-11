/**
 * Routes for registration, login and the current user (UC-001).
 */
import express from 'express';
import { register, login, getMe } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);

export default router;
