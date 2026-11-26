const Joi = require('joi');

const createQuotationSchema = Joi.object({
  order_id:                   Joi.string().uuid().required(),
  apply_gst:                  Joi.boolean().default(false),
  gst_percentage:             Joi.number().min(0).max(28),
  tax_percentage:             Joi.number().min(0).max(28),
  discount:                   Joi.number().min(0).default(0),
  dish_cost:                  Joi.number().min(0),
  ml_ingredient_cost:         Joi.number().min(0),
  // Per-order overrides (optional — defaults come from app_settings)
  labour_cost_per_guest:      Joi.number().min(0),
  labor_cost_per_guest:       Joi.number().min(0),
  lpg_cost_per_guest:         Joi.number().min(0),
  transport_flat:             Joi.number().min(0),
  leaf_cost_per_guest:        Joi.number().min(0),
  disposables_cost_per_guest: Joi.number().min(0),
  overhead_percentage:        Joi.number().min(0).max(100),
  profit_percentage:          Joi.number().min(0).max(100)
});

const createInvoiceSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  quotation_id: Joi.string().uuid(),
  due_date: Joi.date()
});

const createPaymentSchema = Joi.object({
  invoice_id:     Joi.string().uuid().required(),
  payment_method: Joi.string().valid('cash', 'card', 'bank_transfer', 'check', 'upi').required(),
  payment_type:   Joi.string().valid('advance', 'partial', 'final', 'full').default('full'),
  amount:         Joi.number().min(0).required(),
  transaction_id: Joi.string().allow(''),
  notes:          Joi.string().max(300).allow('')
});

const updateInvoiceStatusSchema = Joi.object({
  payment_status: Joi.string().valid('pending', 'partial', 'paid', 'overdue').required()
});

const querySchema = Joi.object({
  order_id: Joi.string().uuid(),
  payment_status: Joi.string().valid('pending', 'partial', 'paid', 'overdue'),
  from_date: Joi.date(),
  to_date: Joi.date(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10)
});

const processRefundSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  amount: Joi.number().min(0.01).required(),
  payment_method: Joi.string().valid('cash', 'card', 'bank_transfer', 'check', 'upi').default('bank_transfer'),
  transaction_id: Joi.string().allow(''),
  reason: Joi.string().required()
});

module.exports = {
  createQuotationSchema,
  createInvoiceSchema,
  createPaymentSchema,
  updateInvoiceStatusSchema,
  processRefundSchema,
  querySchema
};
