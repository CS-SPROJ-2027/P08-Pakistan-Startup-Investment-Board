/**
 * UC-001: Register and Verify Account (user side).
 * Handles registration, login and getting the logged in user's details.
 * New accounts start as "pending" and cannot log in until an admin approves them.
 */
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const ROLES = ['founder', 'investor', 'incubator'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns an error message if the registration form is not valid, otherwise null
function validateRegistration(data: any): string | null {
  const { fullName, email, password, role, organisation } = data;

  // every field is required, and a value with only spaces counts as empty
  const fields = [fullName, email, password, role, organisation];
  if (fields.some((value) => !value || !String(value).trim())) {
    return 'Please fill in all fields';
  }
  if (!ROLES.includes(role)) {
    return 'Please select a valid role';
  }
  if (fullName.trim().length < 3) {
    return 'Full name must be at least 3 characters';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Please enter a valid email address';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

// Creates a new pending account after checking the form and the email
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const errorMessage = validateRegistration(req.body);
    if (errorMessage) {
      throw new AppError(400, errorMessage);
    }

    const { fullName, password, role, organisation } = req.body;
    const email = req.body.email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, organisation)
       VALUES ($1, $2, $3, $4, $5)`,
      [fullName.trim(), email, passwordHash, role, organisation.trim()]
    );

    logger.info(`New ${role} registered: ${email}`);
    res.status(201).json({
      message: 'Registration successful. Your account is pending approval by the administrator.',
    });
  } catch (err) {
    next(err);
  }
}

// Checks email and password, and only lets approved accounts log in
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(400, 'Please enter your email and password');
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError(401, 'Incorrect email or password');
    }
    if (user.status === 'pending') {
      throw new AppError(403, 'Your account is still waiting for administrator approval');
    }
    if (user.status === 'rejected') {
      throw new AppError(403, `Your registration was rejected. Reason: ${user.rejection_reason}`);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'],
    });

    logger.info(`User logged in: ${user.email}`);
    res.json({
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// Returns the details of the logged in user
export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, organisation, status FROM users WHERE id = $1',
      [req.user?.id]
    );
    const user = result.rows[0];
    if (!user || user.status !== 'approved') {
      throw new AppError(401, 'Your account is no longer active');
    }
    res.json({
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, organisation: user.organisation },
    });
  } catch (err) {
    next(err);
  }
}
