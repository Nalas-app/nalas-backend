const Joi = require('joi');

const createQuotationSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  labor_cost_per_guest: Joi.number().min(0).default(500),
  overhead_percentage: Joi.number().min(0).max(100).default(15),
  tax_percentage: Joi.number().min(0).max(100).default(18),
  discount: Joi.number().min(0).default(0)
});

const createInvoiceSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  quotation_id: Joi.string().uuid(),
  due_date: Joi.date()
});

const createPaymentSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  payment_method: Joi.string().valid('cash', 'card', 'bank_transfer', 'check', 'upi').required(),
  amount: Joi.number().min(0).required(),
  transaction_id: Joi.string().allow(''),
  notes: Joi.string().allow('')
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
