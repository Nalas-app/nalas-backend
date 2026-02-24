const Joi = require('joi');

const createPredictionSchema = Joi.object({
  order_item_id: Joi.string().uuid().required(),
  ingredient_cost: Joi.number().min(0).required(),
  labor_cost: Joi.number().min(0).required(),
  overhead_cost: Joi.number().min(0).required(),
  demand_factor: Joi.number().min(0.5).max(2).default(1.0),
  predicted_total: Joi.number().min(0).required(),
  model_version: Joi.string().default('1.0'),
  prediction_confidence: Joi.number().min(0).max(100)
});

const getAnalyticsSchema = Joi.object({
  from_date: Joi.date(),
  to_date: Joi.date(),
  metric: Joi.string().valid('cost', 'profit', 'margin').default('cost')
});

const getTrendsSchema = Joi.object({
  days: Joi.number().min(1).default(30),
  metric: Joi.string().valid('cost', 'profit', 'margin').default('cost')
});

module.exports = {
  createPredictionSchema,
  getAnalyticsSchema,
  getTrendsSchema
};
