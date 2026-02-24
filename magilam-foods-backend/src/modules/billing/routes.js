const express = require('express');
const billingController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  createQuotationSchema,
  createInvoiceSchema,
  createPaymentSchema,
  querySchema
} = require('./validators');

const router = express.Router();

// ===== QUOTATIONS =====
// Create quotation (admin only)
router.post(
  '/quotations',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createQuotationSchema),
  billingController.createQuotation
);

// Get quotation by ID
router.get(
  '/quotations/:id',
  authenticate,
  billingController.getQuotation
);

// List all quotations (admin only)
router.get(
  '/quotations',
  authenticate,
  requireRole('admin', 'super_admin'),
  billingController.listQuotations
);

// ===== INVOICES =====
// Create invoice (admin only)
router.post(
  '/invoices',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createInvoiceSchema),
  billingController.createInvoice
);

// Get invoice by ID
router.get(
  '/invoices/:id',
  authenticate,
  billingController.getInvoice
);

// List all invoices
router.get(
  '/invoices',
  authenticate,
  validate(querySchema, 'query'),
  billingController.listInvoices
);

// ===== PAYMENTS =====
// Record payment
router.post(
  '/payments',
  authenticate,
  validate(createPaymentSchema),
  billingController.recordPayment
);

// Get payments for invoice
router.get(
  '/invoices/:id/payments',
  authenticate,
  billingController.getPayments
);

module.exports = router;
