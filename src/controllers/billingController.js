/**
 * Billing Controller
 * Handles all Billing & Payments endpoints
 * Includes mock data for testing without database
 */


const billingModels = require('../models/billingModels');
const pdfService = require('../services/pdfService');
const db = require('../config/database');
const { NotFoundError, ValidationError, ConflictError } = require('../middleware/errorHandler');

// Mock data for testing without database
const MOCK_QUOTATIONS = [
  {
    id: 'qt-001',
    order_id: 'ord-001',
    subtotal: 10000,
    labor_cost: 1500,
    overhead_cost: 1000,
    tax_amount: 625,
    grand_total: 13125,
    status: 'pending',
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'qt-002',
    order_id: 'ord-002',
    subtotal: 25000,
    labor_cost: 3000,
    overhead_cost: 2000,
    tax_amount: 1500,
    grand_total: 31500,
    status: 'accepted',
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  }
];

const MOCK_INVOICES = [
  {
    id: 'inv-001',
    order_id: 'ord-001',
    quotation_id: 'qt-001',
    grand_total: 13125,
    paid_amount: 5000,
    payment_status: 'partial',
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-002',
    order_id: 'ord-002',
    quotation_id: 'qt-002',
    grand_total: 31500,
    paid_amount: 0,
    payment_status: 'unpaid',
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  }
];

const MOCK_PAYMENTS = [
  {
    id: 'pay-001',
    invoice_id: 'inv-001',
    amount: 5000,
    payment_method: 'upi',
    transaction_id: 'TXN123456',
    payment_status: 'completed',
    created_at: new Date().toISOString()
  }
];

// Helper to check if database is available
const isDatabaseAvailable = async () => {
  try {
    await db.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
};

// ==================== QUOTATION CONTROLLERS ====================

/**
 * Get all quotations (admin)
 * GET /billing/quotations
 */
const getAllQuotations = async (req, res, next) => {
  try {
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      // Return mock data
      return res.json({
        success: true,
        data: MOCK_QUOTATIONS,
        pagination: {
          total: MOCK_QUOTATIONS.length,
          page: 1,
          limit: 20,
          totalPages: 1
        },
        _mock: true
      });
    }
    
    const filters = {
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
    };
    
    const result = await billingModels.getAllQuotations(filters);
    
    res.json({
      success: true,
      data: result.quotations,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new quotation
 * POST /billing/quotations
 */
const createQuotation = async (req, res, next) => {
  try {
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      // Return mock response
      const newQuotation = {
        id: 'qt-' + Date.now(),
        order_id: req.body.orderId,
        subtotal: req.body.subtotal,
        labor_cost: req.body.laborCost,
        overhead_cost: req.body.overheadCost,
        tax_amount: req.body.taxAmount,
        grand_total: req.body.grandTotal,
        status: 'pending',
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };
      return res.status(201).json({
        success: true,
        data: newQuotation,
        message: 'Quotation created (mock mode)',
        _mock: true
      });
    }
    
    const client = await db.getClient();
    await client.query('BEGIN');
    
    const quotation = await billingModels.createQuotation(req.body, client);
    
    const orderResult = await client.query(
      `SELECT o.*, u.full_name, u.email 
       FROM orders o 
       JOIN users u ON o.customer_id = u.id 
       WHERE o.id = $1`,
      [req.body.orderId]
    );
    
    const order = orderResult.rows[0];
    const customer = { full_name: order.full_name, email: order.email };
    
    let pdfUrl = null;
    try {
      pdfUrl = await pdfService.generateQuotationPDF(quotation, order, customer);
      await client.query(
        'UPDATE quotations SET pdf_url = $1 WHERE id = $2',
        [pdfUrl, quotation.id]
      );
      quotation.pdf_url = pdfUrl;
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError.message);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: quotation,
      message: pdfUrl ? 'Quotation created with PDF' : 'Quotation created (PDF generation failed)'
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    
    if (error.message.includes('duplicate') || error.code === '23505') {
      next(new ConflictError('Quotation already exists for this order'));
    } else {
      next(error);
    }
  } finally {
    try { client.release(); } catch (e) {}
  }
};

/**
 * Get quotation by ID
 * GET /billing/quotations/:id
 */
const getQuotationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const quotation = MOCK_QUOTATIONS.find(q => q.id === id);
      if (!quotation) {
        throw new NotFoundError('Quotation not found');
      }
      return res.json({
        success: true,
        data: { ...quotation, isExpired: false },
        _mock: true
      });
    }
    
    const quotation = await billingModels.getQuotationById(id);
    
    if (!quotation) {
      throw new NotFoundError('Quotation not found');
    }
    
    const isExpired = new Date(quotation.valid_until) < new Date();
    
    res.json({
      success: true,
      data: {
        ...quotation,
        isExpired
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quotation by order ID
 * GET /billing/quotations/order/:orderId
 */
const getQuotationByOrderId = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const quotation = MOCK_QUOTATIONS.find(q => q.order_id === orderId);
      if (!quotation) {
        throw new NotFoundError('Quotation not found for this order');
      }
      return res.json({
        success: true,
        data: { ...quotation, isExpired: false },
        _mock: true
      });
    }
    
    const quotation = await billingModels.getQuotationByOrderId(orderId);
    
    if (!quotation) {
      throw new NotFoundError('Quotation not found for this order');
    }
    
    const isExpired = new Date(quotation.valid_until) < new Date();
    
    res.json({
      success: true,
      data: {
        ...quotation,
        isExpired
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate quotation for order
 * GET /billing/quotations/validate/:orderId
 */
const validateQuotation = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      return res.json({
        success: true,
        data: { valid: true, hasQuotation: true, orderId },
        _mock: true
      });
    }
    
    const validation = await billingModels.validateQuotation(orderId);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    next(error);
  }
};

// ==================== INVOICE CONTROLLERS ====================

/**
 * Create a new invoice
 * POST /billing/invoices
 */
const createInvoice = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      // Check if mock invoice exists
      const existingInvoice = MOCK_INVOICES.find(i => i.order_id === orderId);
      if (existingInvoice) {
        return res.json({
          success: true,
          data: existingInvoice,
          message: 'Invoice already exists for this order',
          _mock: true
        });
      }
      
      // Create mock invoice
      const newInvoice = {
        id: 'inv-' + Date.now(),
        order_id: orderId,
        quotation_id: 'qt-' + Date.now(),
        grand_total: 13125,
        paid_amount: 0,
        payment_status: 'unpaid',
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };
      return res.status(201).json({
        success: true,
        data: newInvoice,
        _mock: true
      });
    }
    
    const existingInvoice = await billingModels.getInvoiceByOrderId(orderId);
    if (existingInvoice) {
      return res.json({
        success: true,
        data: existingInvoice,
        message: 'Invoice already exists for this order'
      });
    }
    
    const invoice = await billingModels.createInvoice({ orderId });
    
    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    if (error.message === 'Quotation not found for this order') {
      next(new ValidationError('No valid quotation found for this order. Please generate a quotation first.'));
    } else {
      next(error);
    }
  }
};

/**
 * Get invoice by ID
 * GET /billing/invoices/:id
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const invoice = MOCK_INVOICES.find(i => i.id === id);
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      const outstanding = invoice.grand_total - invoice.paid_amount;
      return res.json({
        success: true,
        data: { ...invoice, outstanding, isOverdue: false },
        _mock: true
      });
    }
    
    const invoice = await billingModels.getInvoiceById(id);
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    
    const outstanding = invoice.grand_total - invoice.paid_amount;
    const isOverdue = new Date(invoice.due_date) < new Date() && invoice.payment_status !== 'paid';
    
    res.json({
      success: true,
      data: {
        ...invoice,
        outstanding,
        isOverdue
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice by order ID
 * GET /billing/invoices/order/:orderId
 */
const getInvoiceByOrderId = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const invoice = MOCK_INVOICES.find(i => i.order_id === orderId);
      if (!invoice) {
        throw new NotFoundError('Invoice not found for this order');
      }
      const outstanding = invoice.grand_total - invoice.paid_amount;
      return res.json({
        success: true,
        data: { ...invoice, outstanding, isOverdue: false },
        _mock: true
      });
    }
    
    const invoice = await billingModels.getInvoiceByOrderId(orderId);
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found for this order');
    }
    
    const outstanding = invoice.grand_total - invoice.paid_amount;
    const isOverdue = new Date(invoice.due_date) < new Date() && invoice.payment_status !== 'paid';
    
    res.json({
      success: true,
      data: {
        ...invoice,
        outstanding,
        isOverdue
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PAYMENT CONTROLLERS ====================

/**
 * Record a new payment
 * POST /billing/payments
 */
const createPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount } = req.body;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const newPayment = {
        id: 'pay-' + Date.now(),
        invoice_id: invoiceId,
        amount: amount,
        payment_method: req.body.paymentMethod,
        transaction_id: req.body.transactionId,
        payment_status: 'completed',
        created_at: new Date().toISOString()
      };
      
      // Update mock invoice
      const invoice = MOCK_INVOICES.find(i => i.id === invoiceId);
      if (invoice) {
        invoice.paid_amount += amount;
        invoice.payment_status = invoice.paid_amount >= invoice.grand_total ? 'paid' : 'partial';
      }
      
      return res.status(201).json({
        success: true,
        data: newPayment,
        invoice: invoice,
        _mock: true
      });
    }
    
    const invoice = await billingModels.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    
    const outstanding = invoice.grand_total - invoice.paid_amount;
    
    if (amount > outstanding) {
      throw new ValidationError(`Amount exceeds outstanding balance. Outstanding: ${outstanding}`);
    }
    
    const paymentData = {
      ...req.body,
      createdBy: req.user?.userId
    };
    
    const payment = await billingModels.createPayment(paymentData);
    const updatedInvoice = await billingModels.getInvoiceById(invoiceId);
    
    res.status(201).json({
      success: true,
      data: payment,
      invoice: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payments by invoice ID
 * GET /billing/payments?invoiceId=X
 */
const getPaymentsByInvoice = async (req, res, next) => {
  try {
    const { invoiceId } = req.query;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      if (!invoiceId) {
        throw new ValidationError('Invoice ID is required');
      }
      const payments = MOCK_PAYMENTS.filter(p => p.invoice_id === invoiceId);
      return res.json({
        success: true,
        data: payments,
        _mock: true
      });
    }
    
    if (!invoiceId) {
      throw new ValidationError('Invoice ID is required');
    }
    
    const payments = await billingModels.getPaymentsByInvoiceId(invoiceId);
    
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payments (admin)
 * GET /billing/payments
 */
const getAllPayments = async (req, res, next) => {
  try {
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      return res.json({
        success: true,
        data: MOCK_PAYMENTS,
        pagination: {
          total: MOCK_PAYMENTS.length,
          page: 1,
          limit: 20,
          totalPages: 1
        },
        _mock: true
      });
    }
    
    const filters = {
      invoiceId: req.query.invoiceId,
      from: req.query.from,
      to: req.query.to,
      method: req.query.method,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
    };
    
    const result = await billingModels.getAllPayments(filters);
    
    res.json({
      success: true,
      data: result.payments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a refund
 * POST /billing/payments/refund
 */
const recordRefund = async (req, res, next) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      const newRefund = {
        id: 'ref-' + Date.now(),
        payment_id: paymentId,
        amount: amount,
        reason: reason,
        status: 'completed',
        created_at: new Date().toISOString()
      };
      return res.status(201).json({
        success: true,
        data: newRefund,
        message: 'Refund processed successfully',
        _mock: true
      });
    }
    
    const originalPayment = await billingModels.getPaymentById(paymentId);
    if (!originalPayment) {
      throw new NotFoundError('Payment not found');
    }
    
    if (amount > originalPayment.amount) {
      throw new ValidationError('Refund amount cannot exceed original payment amount');
    }
    
    const refundData = {
      paymentId,
      amount,
      reason,
      createdBy: req.user?.userId
    };
    
    const result = await billingModels.recordRefund(refundData);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==================== REPORT CONTROLLERS ====================

/**
 * Get revenue report
 * GET /billing/reports/revenue
 */
const getRevenueReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      return res.json({
        success: true,
        data: {
          totalRevenue: 5000,
          totalInvoices: 2,
          paidInvoices: 1,
          unpaidInvoices: 1,
          overdueInvoices: 0,
          averageInvoiceValue: 22312.5,
          period: { from, to }
        },
        _mock: true
      });
    }
    
    const report = await billingModels.getRevenueReport(from, to);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark overdue invoices (admin)
 * POST /billing/invoices/mark-overdue
 */
const markOverdueInvoices = async (req, res, next) => {
  try {
    const dbAvailable = await isDatabaseAvailable();
    
    if (!dbAvailable) {
      return res.json({
        success: true,
        data: { markedOverdue: 0 },
        _mock: true
      });
    }
    
    const count = await billingModels.markOverdueInvoices();
    
    res.json({
      success: true,
      data: {
        markedOverdue: count
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Quotation controllers
  getAllQuotations,
  createQuotation,
  getQuotationById,
  getQuotationByOrderId,
  validateQuotation,
  
  // Invoice controllers
  createInvoice,
  getInvoiceById,
  getInvoiceByOrderId,
  markOverdueInvoices,
  
  // Payment controllers
  createPayment,
  getPaymentsByInvoice,
  getAllPayments,
  recordRefund,
  
  // Report controllers
  getRevenueReport
};
