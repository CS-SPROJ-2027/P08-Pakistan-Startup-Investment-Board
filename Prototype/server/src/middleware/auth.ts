/**
 * Authentication middleware.
 * verifyToken checks the login token sent in the Authorization header.
 * requireRole only lets users with the given roles continue.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface TokenUser {
  id: number;
  role: string;
}

// a request that has passed verifyToken
export interface AuthRequest extends Request {
  user?: TokenUser;
}

export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Please log in first'));
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET as string) as TokenUser;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Your session has expired. Please log in again'));
    }
    next(new AppError(401, 'Invalid login token. Please log in again'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to do this'));
    }
    next();
  };
}
