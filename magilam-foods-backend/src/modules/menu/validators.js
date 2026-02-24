const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  display_order: Joi.number().min(0),
  is_active: Joi.boolean().default(true)
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100),
  display_order: Joi.number().min(0),
  is_active: Joi.boolean()
});

const createMenuItemSchema = Joi.object({
  category_id: Joi.string().uuid().required(),
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(500),
  base_unit: Joi.string().valid('serving', 'kg', 'piece', 'plate', 'box').required(),
  min_quantity: Joi.number().min(0.5).default(1),
  image_url: Joi.string().uri().allow(''),
  is_customizable: Joi.boolean().default(false),
  is_active: Joi.boolean().default(true),
  base_price: Joi.number().min(0)
});

const updateMenuItemSchema = Joi.object({
  category_id: Joi.string().uuid(),
  name: Joi.string().min(2).max(255),
  description: Joi.string().max(500),
  base_unit: Joi.string().valid('serving', 'kg', 'piece', 'plate', 'box'),
  min_quantity: Joi.number().min(0.5),
  image_url: Joi.string().uri().allow(''),
  is_customizable: Joi.boolean(),
  is_active: Joi.boolean(),
  base_price: Joi.number().min(0)
});

const createRecipeSchema = Joi.object({
  ingredient_id: Joi.string().uuid().required(),
  quantity_per_base_unit: Joi.number().min(0).required(),
  wastage_factor: Joi.number().min(1).default(1.05)
});

const querySchema = Joi.object({
  name: Joi.string(),
  category_id: Joi.string().uuid(),
  is_active: Joi.boolean(),
  is_customizable: Joi.boolean(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10)
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createRecipeSchema,
  querySchema
};
