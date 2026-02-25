/**
 * Authentication Middleware
 * JWT Token Verification
 */

const jwt = require('jsonwebtoken');
const appConfig = require('../config/app');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = (req, res, next) => {
  // Development mode: bypass authentication
  if (appConfig.env === 'development') {
    req.user = {
      userId: 'dev-user-001',
      email: 'dev@example.com',
      role: 'admin'
    };
    return next();
  }
  
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('No token provided');
    }
    
    // Check Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Invalid token format');
    }
    
    const token = parts[1];
    
    // Verify token
    const decoded = jwt.verify(token, appConfig.jwt.secret);
    
    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Check if user has required role(s)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const decoded = jwt.verify(parts[1], appConfig.jwt.secret);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      }
    }
    
    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  requireRole,
  optionalAuth
};
