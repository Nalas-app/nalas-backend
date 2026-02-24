const Joi = require('joi');

const createIngredientSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  unit: Joi.string().valid('kg', 'liter', 'piece', 'gram', 'ml', 'dozen', 'tsp', 'tbsp').required(),
  current_price_per_unit: Joi.number().min(0).required(),
  reorder_level: Joi.number().min(0).default(0),
  is_perishable: Joi.boolean().default(false),
  shelf_life_days: Joi.number().min(0).when('is_perishable', {
    is: true,
    then: Joi.required()
  })
});

const updateIngredientSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  unit: Joi.string().valid('kg', 'liter', 'piece', 'gram', 'ml', 'dozen', 'tsp', 'tbsp'),
  current_price_per_unit: Joi.number().min(0),
  reorder_level: Joi.number().min(0),
  is_perishable: Joi.boolean(),
  shelf_life_days: Joi.number().min(0)
});

const createTransactionSchema = Joi.object({
  ingredient_id: Joi.string().uuid().required(),
  transaction_type: Joi.string().valid('purchase', 'consumption', 'wastage', 'adjustment').required(),
  quantity: Joi.number().required(),
  unit_price: Joi.number().min(0),
  reference_id: Joi.string(),
  notes: Joi.string().max(500)
});

const reserveStockSchema = Joi.object({
  ingredient_id: Joi.string().uuid().required(),
  quantity: Joi.number().min(0).required(),
  order_id: Joi.string().uuid().required()
});

const querySchema = Joi.object({
  name: Joi.string(),
  is_perishable: Joi.boolean(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  sortBy: Joi.string().default('created_at')
});

module.exports = {
  createIngredientSchema,
  updateIngredientSchema,
  createTransactionSchema,
  reserveStockSchema,
  querySchema
};
