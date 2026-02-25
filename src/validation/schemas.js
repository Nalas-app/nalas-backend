/**
 * Joi Validation Schemas for Billing Module
 */

const Joi = require('joi');

// ==================== QUOTATION SCHEMAS ====================

const createQuotationSchema = Joi.object({
  orderId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    }),
  subtotal: Joi.number().positive().required()
    .messages({
      'number.positive': 'Subtotal must be a positive number',
      'any.required': 'Subtotal is required'
    }),
  laborCost: Joi.number().min(0).default(0),
  overheadCost: Joi.number().min(0).default(0),
  discount: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
  grandTotal: Joi.number().positive().required()
    .messages({
      'number.positive': 'Grand total must be a positive number',
      'any.required': 'Grand total is required'
    })
});

const quotationIdSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Quotation ID must be a valid UUID'
    })
});

const orderIdParamSchema = Joi.object({
  orderId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID'
    })
});

// ==================== INVOICE SCHEMAS ====================

const createInvoiceSchema = Joi.object({
  orderId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    })
});

const invoiceIdSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invoice ID must be a valid UUID'
    })
});

// ==================== PAYMENT SCHEMAS ====================

const paymentMethods = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

const createPaymentSchema = Joi.object({
  invoiceId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Invoice ID must be a valid UUID',
      'any.required': 'Invoice ID is required'
    }),
  amount: Joi.number().positive().required()
    .messages({
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  paymentMethod: Joi.string().valid(...paymentMethods).required()
    .messages({
      'any.only': `Payment method must be one of: ${paymentMethods.join(', ')}`,
      'any.required': 'Payment method is required'
    }),
  transactionId: Joi.string().max(100).allow('', null),
  paymentDate: Joi.date().default(new Date())
});

const paymentIdSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Payment ID must be a valid UUID'
    })
});

const paymentQuerySchema = Joi.object({
  invoiceId: Joi.string().uuid(),
  from: Joi.date(),
  to: Joi.date(),
  method: Joi.string().valid(...paymentMethods),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// ==================== REPORT SCHEMAS ====================

const revenueReportSchema = Joi.object({
  from: Joi.date().required()
    .messages({
      'any.required': 'Start date is required'
    }),
  to: Joi.date().min(Joi.ref('from')).required()
    .messages({
      'any.required': 'End date is required',
      'date.min': 'End date must be after start date'
    })
});

// ==================== REFUND SCHEMAS ====================

const refundSchema = Joi.object({
  paymentId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Payment ID must be a valid UUID',
      'any.required': 'Payment ID is required'
    }),
  amount: Joi.number().positive().required()
    .messages({
      'number.positive': 'Refund amount must be a positive number',
      'any.required': 'Refund amount is required'
    }),
  reason: Joi.string().max(500).required()
    .messages({
      'string.max': 'Reason must not exceed 500 characters',
      'any.required': 'Reason is required'
    })
});

module.exports = {
  // Quotation schemas
  createQuotationSchema,
  quotationIdSchema,
  orderIdParamSchema,
  
  // Invoice schemas
  createInvoiceSchema,
  invoiceIdSchema,
  
  // Payment schemas
  createPaymentSchema,
  paymentIdSchema,
  paymentQuerySchema,
  
  // Report schemas
  revenueReportSchema,
  
  // Refund schemas
  refundSchema,
  
  // Valid payment methods
  paymentMethods
};
