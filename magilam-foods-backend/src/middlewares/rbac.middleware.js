const AppError = require('../shared/errors/AppError');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }

    next();
  };
};

module.exports = { requireRole };