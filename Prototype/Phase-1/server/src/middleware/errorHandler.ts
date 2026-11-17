/**
 * Error handling middleware.
 * Any error passed to next(err) ends up here and is returned as JSON.
 * Errors with a status (e.g. 400, 404) show their own message;
 * unexpected errors are logged and a general message is returned.
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export class AppError extends Error {
  status: number;
  details?: object;

  constructor(status: number, message: string, details?: object) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Sends a 404 error for API routes that do not exist
export function notFound(req: Request, res: Response, next: NextFunction) {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
}

// next is unused but Express needs all 4 parameters to treat this as an error handler
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  // PostgreSQL error codes
  if (err.code === '23505') {
    return res.status(409).json({ error: 'This record already exists' });
  }
  if (err.code === '22P02' || err.code === '22003') {
    return res.status(400).json({ error: 'One of the values entered is not valid' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    logger.error(`Database connection failed: ${err.message}`);
    return res.status(503).json({ error: 'The database is not reachable right now. Please try again later.' });
  }
  logger.error(err.stack || err.message);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
