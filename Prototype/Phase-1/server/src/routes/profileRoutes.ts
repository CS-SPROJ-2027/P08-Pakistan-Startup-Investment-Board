/**
 * Routes for the founder's startup profile (UC-004).
 * Only logged in founders can use these.
 */
import express from 'express';
import { getMyProfile, saveDraft, submitProfile } from '../controllers/profileController';
import { verifyToken, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken, requireRole('founder'));

router.get('/', getMyProfile);
router.put('/', saveDraft);
router.post('/submit', submitProfile);

export default router;
