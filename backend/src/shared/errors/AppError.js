class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = {}) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static conflict(message, details = {}) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static unprocessable(message, details = {}) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

module.exports = AppError;