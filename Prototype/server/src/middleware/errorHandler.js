/**
 * Error handling middleware.
 * Any error passed to next(err) ends up here and is returned as JSON.
 * Errors with a status (e.g. 400, 404) show their own message;
 * unexpected errors are logged and a general message is returned.
 */
const logger = require('../config/logger');

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res, next) {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  logger.error(err.stack || err.message);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}

module.exports = { AppError, notFound, errorHandler };
