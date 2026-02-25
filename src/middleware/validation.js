/**
 * Validation Middleware
 * Validates request body/params/query using Joi schemas
 */

const { ValidationError } = require('./errorHandler');

/**
 * Validate request using Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} source - 'body', 'params', or 'query'
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(new ValidationError('Validation failed', errors));
    }
    
    // Replace validated data
    req[source] = value;
    
    next();
  };
};

module.exports = {
  validate
};
