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
  logger.error(err.stack || err.message);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
