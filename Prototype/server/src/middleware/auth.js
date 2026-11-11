/**
 * Authentication middleware.
 * verifyToken checks the login token sent in the Authorization header.
 * requireRole only lets users with the given roles continue.
 */
const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Please log in first'));
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Your session has expired. Please log in again'));
    }
    next(new AppError(401, 'Invalid login token. Please log in again'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to do this'));
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
