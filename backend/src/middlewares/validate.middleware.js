const Joi = require('joi');
const AppError = require('../shared/errors/AppError');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.reduce((acc, curr) => {
        acc[curr.path.join('.')] = curr.message;
        return acc;
      }, {});

      return next(AppError.unprocessable('Validation failed', details));
    }

    req[property] = value;
    next();
  };
};

module.exports = { validate };