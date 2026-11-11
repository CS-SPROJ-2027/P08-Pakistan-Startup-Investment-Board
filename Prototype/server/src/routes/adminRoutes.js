/**
 * Routes for the administrator to review registrations (UC-001).
 * All routes require an admin login.
 */
const express = require('express');
const { getUsers, reviewUser } = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRole('admin'));

router.get('/users', getUsers);
router.post('/users/:id/review', reviewUser);

module.exports = router;
