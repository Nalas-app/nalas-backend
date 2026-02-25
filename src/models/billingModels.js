/**
 * Billing Models - Database Queries
 * PostgreSQL queries using pg driver
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate quotation number
 * Format: QT-YYYYMMDD-XXX
 */
const generateQuotationNumber = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `QT-${today}`;
  
  const result = await db.query(
    `SELECT quotation_number FROM quotations 
     WHERE quotation_number LIKE $1 
     ORDER BY quotation_number DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );
  
  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].quotation_number;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  return `${prefix}-${sequence.toString().padStart(3, '0')}`;
};

/**
 * Generate invoice number
 * Format: INV-YYYYMMDD-XXX
 */
const generateInvoiceNumber = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${today}`;
  
  const result = await db.query(
    `SELECT invoice_number FROM invoices 
     WHERE invoice_number LIKE $1 
     ORDER BY invoice_number DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );
  
  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].invoice_number;
    const lastSequence = parseInt(lastNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  return `${prefix}-${sequence.toString().padStart(3, '0')}`;
};

// ==================== QUOTATION MODELS ====================

/**
 * Get all quotations with filters
 */
const getAllQuotations = async (filters = {}) => {
  const { status, from, to, page = 1, limit = 20 } = filters;
  
  let whereConditions = [];
  let params = [];
  let paramIndex = 1;
  
  if (status) {
    whereConditions.push(`q.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }
  
  if (from) {
    whereConditions.push(`q.created_at >= $${paramIndex}`);
    params.push(from);
    paramIndex++;
  }
  
  if (to) {
    whereConditions.push(`q.created_at <= $${paramIndex}`);
    params.push(to);
    paramIndex++;
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';
  
  const offset = (page - 1) * limit;
  
  const countResult = await db.query(
    `SELECT COUNT(*) FROM quotations q ${whereClause}`,
    params
  );
  
  const result = await db.query(
    `SELECT q.*, o.event_date, o.guest_count,
            u.full_name as customer_name
     FROM quotations q
     JOIN orders o ON q.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     ${whereClause}
     ORDER BY q.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );
  
  return {
    quotations: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
    totalPages: Math.ceil(countResult.rows[0].count / limit)
  };
};

/**
 * Create a new quotation
 * @param {Object} quotationData - Quotation data
 * @param {Object} client - Optional database client for transaction
 */
const createQuotation = async (quotationData, client = null) => {
  const { 
    orderId, 
    subtotal, 
    laborCost = 0, 
    overheadCost = 0, 
    discount = 0, 
    taxAmount = 0, 
    grandTotal 
  } = quotationData;
  
  const dbClient = client || db;
  const query = dbClient.query.bind(dbClient);
  
  const id = uuidv4();
  const quotationNumber = await generateQuotationNumber();
  
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);
  
  const result = await query(
    `INSERT INTO quotations (
      id, order_id, quotation_number, subtotal, labor_cost, 
      overhead_cost, discount, tax_amount, grand_total, 
      valid_until, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *`,
    [id, orderId, quotationNumber, subtotal, laborCost, overheadCost, 
     discount, taxAmount, grandTotal, validUntil, 'pending']
  );
  
  return result.rows[0];
};

/**
 * Get quotation by ID
 */
const getQuotationById = async (id) => {
  const result = await db.query(
    `SELECT q.*, o.event_date, o.guest_count, o.venue_address,
            u.full_name as customer_name, u.email as customer_email
     FROM quotations q
     JOIN orders o ON q.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     WHERE q.id = $1`,
    [id]
  );
  
  return result.rows[0];
};

/**
 * Get quotation by order ID
 */
const getQuotationByOrderId = async (orderId) => {
  const result = await db.query(
    `SELECT q.*, o.event_date, o.guest_count, o.venue_address,
            u.full_name as customer_name, u.email as customer_email
     FROM quotations q
     JOIN orders o ON q.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     WHERE q.order_id = $1
     ORDER BY q.created_at DESC
     LIMIT 1`,
    [orderId]
  );
  
  return result.rows[0];
};

/**
 * Validate quotation for order
 */
const validateQuotation = async (orderId) => {
  const quotation = await getQuotationByOrderId(orderId);
  
  if (!quotation) {
    return { valid: false, reason: 'No quotation found' };
  }
  
  const now = new Date();
  const validUntil = new Date(quotation.valid_until);
  
  if (validUntil < now) {
    return { valid: false, reason: 'Quotation expired', quotation };
  }
  
  return { valid: true, quotation };
};

/**
 * Update quotation status
 */
const updateQuotationStatus = async (id, status) => {
  const result = await db.query(
    `UPDATE quotations 
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  
  return result.rows[0];
};

// ==================== INVOICE MODELS ====================

/**
 * Create a new invoice
 */
const createInvoice = async (invoiceData) => {
  const { orderId, quotationId } = invoiceData;
  
  const id = uuidv4();
  const invoiceNumber = await generateInvoiceNumber();
  
  const quotation = await getQuotationByOrderId(orderId);
  
  if (!quotation) {
    throw new Error('Quotation not found for this order');
  }
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);
  
  const result = await db.query(
    `INSERT INTO invoices (
      id, order_id, quotation_id, invoice_number, 
      subtotal, labor_cost, overhead_cost, discount, 
      tax_amount, grand_total, invoice_date, due_date,
      paid_amount, payment_status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *`,
    [id, orderId, quotationId || quotation.id, invoiceNumber,
     quotation.subtotal, quotation.labor_cost, quotation.overhead_cost,
     quotation.discount, quotation.tax_amount, quotation.grand_total,
     new Date(), dueDate, 0, 'pending']
  );
  
  return result.rows[0];
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (id) => {
  const result = await db.query(
    `SELECT i.*, o.event_date, o.guest_count, o.venue_address,
            u.full_name as customer_name, u.email as customer_email,
            q.quotation_number
     FROM invoices i
     JOIN orders o ON i.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     LEFT JOIN quotations q ON i.quotation_id = q.id
     WHERE i.id = $1`,
    [id]
  );
  
  return result.rows[0];
};

/**
 * Get invoice by order ID
 */
const getInvoiceByOrderId = async (orderId) => {
  const result = await db.query(
    `SELECT i.*, o.event_date, o.guest_count, o.venue_address,
            u.full_name as customer_name, u.email as customer_email,
            q.quotation_number
     FROM invoices i
     JOIN orders o ON i.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     LEFT JOIN quotations q ON i.quotation_id = q.id
     WHERE i.order_id = $1
     ORDER BY i.created_at DESC
     LIMIT 1`,
    [orderId]
  );
  
  return result.rows[0];
};

/**
 * Update invoice payment status
 */
const updateInvoicePaymentStatus = async (id) => {
  const invoice = await getInvoiceById(id);
  
  let paymentStatus = 'pending';
  if (invoice.paid_amount >= invoice.grand_total) {
    paymentStatus = 'paid';
  } else if (invoice.paid_amount > 0) {
    paymentStatus = 'partial';
  }
  
  const result = await db.query(
    `UPDATE invoices 
     SET payment_status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [paymentStatus, id]
  );
  
  return result.rows[0];
};

// ==================== PAYMENT MODELS ====================

/**
 * Record a new payment
 */
const createPayment = async (paymentData) => {
  const { invoiceId, amount, paymentMethod, transactionId, paymentDate, createdBy } = paymentData;
  
  const id = uuidv4();
  
  const result = await db.query(
    `INSERT INTO payments (
      id, invoice_id, payment_method, amount, transaction_id,
      payment_date, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *`,
    [id, invoiceId, paymentMethod, amount, transactionId || null, 
     paymentDate || new Date(), createdBy || null]
  );
  
  await db.query(
    `UPDATE invoices 
     SET paid_amount = paid_amount + $1, updated_at = NOW()
     WHERE id = $2`,
    [amount, invoiceId]
  );
  
  await updateInvoicePaymentStatus(invoiceId);
  
  return result.rows[0];
};

/**
 * Get payment by ID
 */
const getPaymentById = async (id) => {
  const result = await db.query(
    `SELECT p.*, i.invoice_number, i.grand_total, i.paid_amount
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE p.id = $1`,
    [id]
  );
  
  return result.rows[0];
};

/**
 * Get payments by invoice ID
 */
const getPaymentsByInvoiceId = async (invoiceId) => {
  const result = await db.query(
    `SELECT p.*, u.full_name as created_by_name
     FROM payments p
     LEFT JOIN users u ON p.created_by = u.id
     WHERE p.invoice_id = $1
     ORDER BY p.payment_date DESC`,
    [invoiceId]
  );
  
  return result.rows;
};

/**
 * Get all payments with filters
 */
const getAllPayments = async (filters = {}) => {
  const { invoiceId, from, to, method, page = 1, limit = 20 } = filters;
  
  let whereConditions = [];
  let params = [];
  let paramIndex = 1;
  
  if (invoiceId) {
    whereConditions.push(`p.invoice_id = $${paramIndex}`);
    params.push(invoiceId);
    paramIndex++;
  }
  
  if (from) {
    whereConditions.push(`p.payment_date >= $${paramIndex}`);
    params.push(from);
    paramIndex++;
  }
  
  if (to) {
    whereConditions.push(`p.payment_date <= $${paramIndex}`);
    params.push(to);
    paramIndex++;
  }
  
  if (method) {
    whereConditions.push(`p.payment_method = $${paramIndex}`);
    params.push(method);
    paramIndex++;
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';
  
  const offset = (page - 1) * limit;
  
  const countResult = await db.query(
    `SELECT COUNT(*) FROM payments p ${whereClause}`,
    params
  );
  
  const result = await db.query(
    `SELECT p.*, i.invoice_number, o.id as order_id,
            u.full_name as customer_name
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     JOIN orders o ON i.order_id = o.id
     JOIN users u ON o.customer_id = u.id
     ${whereClause}
     ORDER BY p.payment_date DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );
  
  return {
    payments: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
    totalPages: Math.ceil(countResult.rows[0].count / limit)
  };
};

/**
 * Record a refund
 */
const recordRefund = async (refundData) => {
  const { paymentId, amount, reason, createdBy } = refundData;
  
  const originalPayment = await db.query(
    `SELECT * FROM payments WHERE id = $1`,
    [paymentId]
  );
  
  if (originalPayment.rows.length === 0) {
    throw new Error('Payment not found');
  }
  
  const invoiceId = originalPayment.rows[0].invoice_id;
  
  const id = uuidv4();
  await db.query(
    `INSERT INTO payments (
      id, invoice_id, payment_method, amount, transaction_id,
      payment_date, notes, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [id, invoiceId, 'refund', -amount, null, new Date(), 
     `Refund: ${reason}`, createdBy || null]
  );
  
  await db.query(
    `UPDATE invoices 
     SET paid_amount = paid_amount - $1, updated_at = NOW()
     WHERE id = $2`,
    [amount, invoiceId]
  );
  
  await updateInvoicePaymentStatus(invoiceId);
  
  return { success: true, refundId: id };
};

// ==================== REPORT MODELS ====================

/**
 * Get revenue report
 */
const getRevenueReport = async (from, to) => {
  const totalResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total_revenue,
            COUNT(*) as total_payments
     FROM payments 
     WHERE amount > 0 
     AND payment_date >= $1 
     AND payment_date <= $2`,
    [from, to]
  );
  
  const byMethodResult = await db.query(
    `SELECT payment_method, 
            COALESCE(SUM(amount), 0) as revenue,
            COUNT(*) as count
     FROM payments 
     WHERE amount > 0
     AND payment_date >= $1 
     AND payment_date <= $2
     GROUP BY payment_method`,
    [from, to]
  );
  
  const invoiceStats = await db.query(
    `SELECT 
       COUNT(*) FILTER (WHERE payment_status = 'paid') as invoices_paid,
       COUNT(*) FILTER (WHERE payment_status IN ('pending', 'partial')) as invoices_pending,
       COUNT(*) FILTER (WHERE payment_status = 'overdue') as invoices_overdue
     FROM invoices 
     WHERE invoice_date >= $1 
     AND invoice_date <= $2`,
    [from, to]
  );
  
  const byMethod = {};
  byMethodResult.rows.forEach(row => {
    byMethod[row.payment_method] = {
      revenue: parseFloat(row.revenue),
      count: parseInt(row.count, 10)
    };
  });
  
  return {
    totalRevenue: parseFloat(totalResult.rows[0].total_revenue),
    totalPayments: parseInt(totalResult.rows[0].total_payments, 10),
    byMethod,
    invoicesPaid: parseInt(invoiceStats.rows[0].invoices_paid, 10),
    invoicesPending: parseInt(invoiceStats.rows[0].invoices_pending, 10),
    invoicesOverdue: parseInt(invoiceStats.rows[0].invoices_overdue, 10)
  };
};

/**
 * Mark overdue invoices
 */
const markOverdueInvoices = async () => {
  const result = await db.query(
    `UPDATE invoices 
     SET payment_status = 'overdue', updated_at = NOW()
     WHERE due_date < NOW() 
     AND payment_status IN ('pending', 'partial')
     RETURNING id`
  );
  
  return result.rows.length;
};

module.exports = {
  getAllQuotations,
  createQuotation,
  getQuotationById,
  getQuotationByOrderId,
  validateQuotation,
  updateQuotationStatus,
  createInvoice,
  getInvoiceById,
  getInvoiceByOrderId,
  updateInvoicePaymentStatus,
  createPayment,
  getPaymentById,
  getPaymentsByInvoiceId,
  getAllPayments,
  recordRefund,
  getRevenueReport,
  markOverdueInvoices
};
