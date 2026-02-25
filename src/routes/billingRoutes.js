/**
 * Billing Routes
 * All Billing & Payments endpoints
 */

const express = require('express');
const router = express.Router();

const billingController = require('../controllers/billingController');
const { authenticate, requireRole } = require('../middleware/auth');
const validation = require('../middleware/validation');
const schemas = require('../validation/schemas');

// ==================== PUBLIC TEST ROUTES ====================

// GET /billing - Base billing API info (public)
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Billing & Payments API',
    version: '1.0.0',
    endpoints: {
      quotations: '/billing/quotations',
      invoices: '/billing/invoices',
      payments: '/billing/payments',
      reports: '/billing/reports'
    },
    documentation: 'Visit /api-info for full API documentation'
  });
});

// GET /billing/test - Public test endpoint (no auth required)
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Billing API is working!',
    timestamp: new Date().toISOString()
  });
});

// ==================== QUOTATION ROUTES ====================

// GET /billing/quotations - Get all quotations (admin only)
router.get(
  '/quotations',
  authenticate,
  requireRole('admin', 'super_admin'),
  billingController.getAllQuotations
);

// POST /billing/quotations - Create quotation
router.post(
  '/quotations',
  authenticate,
  validation.validate(schemas.createQuotationSchema),
  billingController.createQuotation
);

// GET /billing/quotations/:id - Get quotation by ID
router.get(
  '/quotations/:id',
  authenticate,
  validation.validate(schemas.quotationIdSchema, 'params'),
  billingController.getQuotationById
);

// GET /billing/quotations/order/:orderId - Get quotation by order
router.get(
  '/quotations/order/:orderId',
  authenticate,
  validation.validate(schemas.orderIdParamSchema, 'params'),
  billingController.getQuotationByOrderId
);

// GET /billing/quotations/validate/:orderId - Validate quotation
router.get(
  '/quotations/validate/:orderId',
  authenticate,
  validation.validate(schemas.orderIdParamSchema, 'params'),
  billingController.validateQuotation
);

// ==================== INVOICE ROUTES ====================

// POST /billing/invoices - Create invoice
router.post(
  '/invoices',
  authenticate,
  validation.validate(schemas.createInvoiceSchema),
  billingController.createInvoice
);

// GET /billing/invoices/:id - Get invoice by ID
router.get(
  '/invoices/:id',
  authenticate,
  validation.validate(schemas.invoiceIdSchema, 'params'),
  billingController.getInvoiceById
);

// GET /billing/invoices/order/:orderId - Get invoice by order
router.get(
  '/invoices/order/:orderId',
  authenticate,
  validation.validate(schemas.orderIdParamSchema, 'params'),
  billingController.getInvoiceByOrderId
);

// POST /billing/invoices/mark-overdue - Mark overdue invoices (admin)
router.post(
  '/invoices/mark-overdue',
  authenticate,
  requireRole('admin', 'super_admin'),
  billingController.markOverdueInvoices
);

// ==================== PAYMENT ROUTES ====================

// POST /billing/payments - Record payment
router.post(
  '/payments',
  authenticate,
  requireRole('admin', 'super_admin'),
  validation.validate(schemas.createPaymentSchema),
  billingController.createPayment
);

// GET /billing/payments - Get all payments (admin)
router.get(
  '/payments',
  authenticate,
  requireRole('admin', 'super_admin'),
  validation.validate(schemas.paymentQuerySchema, 'query'),
  billingController.getAllPayments
);

// GET /billing/payments?invoiceId=X - Get payments by invoice
router.get(
  '/payments/invoice/:invoiceId',
  authenticate,
  validation.validate(schemas.invoiceIdSchema, 'params'),
  billingController.getPaymentsByInvoice
);

// POST /billing/payments/refund - Record refund (admin)
router.post(
  '/payments/refund',
  authenticate,
  requireRole('admin', 'super_admin'),
  validation.validate(schemas.refundSchema),
  billingController.recordRefund
);

// ==================== REPORT ROUTES ====================

// GET /billing/reports/revenue - Get revenue report (admin)
router.get(
  '/reports/revenue',
  authenticate,
  requireRole('admin', 'super_admin'),
  validation.validate(schemas.revenueReportSchema, 'query'),
  billingController.getRevenueReport
);

module.exports = router;
