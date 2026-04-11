const Joi = require('joi');

const createOrderSchema = Joi.object({
  event_date: Joi.date().min('now').required(),
  event_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
  event_type: Joi.string().valid('Wedding', 'Conference', 'Birthday', 'Corporate', 'Family Gathering', 'Other').required(),
  guest_count: Joi.number().min(10).max(10000).required(),
  venue_address: Joi.string().min(10).required(),
  special_requests: Joi.string().allow(''),
  order_items: Joi.array().items(
    Joi.object({
      menu_item_id: Joi.string().uuid().required(),
      quantity: Joi.number().min(0.5).required(),
      customizations: Joi.object().default({})
    })
  ).min(1).required()
});

const updateOrderSchema = Joi.object({
  event_date: Joi.date(),
  event_time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  event_type: Joi.string().valid('Wedding', 'Conference', 'Birthday', 'Corporate', 'Family Gathering', 'Other'),
  guest_count: Joi.number().min(10).max(10000),
  venue_address: Joi.string().min(10),
  special_requests: Joi.string().allow(''),
  order_items: Joi.array().items(
    Joi.object({
      menu_item_id: Joi.string().uuid().required(),
      quantity: Joi.number().min(0.5).required(),
      customizations: Joi.object().default({})
    })
  ).min(1)
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'quoted', 'confirmed', 'preparing', 'completed', 'cancelled').required()
});

const querySchema = Joi.object({
  status: Joi.string().valid('draft', 'quoted', 'confirmed', 'preparing', 'completed', 'cancelled'),
  from_date: Joi.date(),
  to_date: Joi.date(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10)
});

module.exports = {
  createOrderSchema,
  updateOrderSchema,
  updateStatusSchema,
  querySchema
};
