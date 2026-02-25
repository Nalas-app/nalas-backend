/**
 * Error Handling Middleware
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

/**
 * Validation Error
 */
class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details = null) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Conflict Error
 */
class ConflictError extends ApiError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(409, code, message);
  }
}

/**
 * Unauthorized Error
 */
class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/**
 * Forbidden Error
 */
class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  if (process.env.NODE_ENV !== 'test') {
    console.error('Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  }

  // Handle specific error types
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Handle PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists'
      }
    });
  }

  // Handle PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced resource does not exist'
      }
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    }
  });
};

module.exports = {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  errorHandler
};
