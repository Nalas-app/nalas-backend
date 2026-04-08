const db = require('../../config/database');

class BillingRepository {
  // ===== QUOTATIONS =====
  async createQuotation(data) {
    const query = `
      INSERT INTO quotations 
      (order_id, quotation_number, subtotal, labor_cost, overhead_cost, discount, tax_amount, grand_total, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    // Generate unique quotation number
    const quotationNumber = `QUOT-${Date.now()}`;
    
    const result = await db.query(query, [
      data.order_id,
      quotationNumber,
      data.subtotal,
      data.labor_cost,
      data.overhead_cost,
      data.discount || 0,
      data.tax_amount,
      data.grand_total,
      data.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    ]);
    return result.rows[0];
  }

  async findQuotationById(id) {
    const query = 'SELECT * FROM quotations WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findQuotationByOrderId(orderId) {
    const query = 'SELECT * FROM quotations WHERE order_id = $1';
    const result = await db.query(query, [orderId]);
    return result.rows[0] || null;
  }

  async findAllQuotations(filters = {}, limit = 10, offset = 0) {
    let query = 'SELECT * FROM quotations WHERE 1=1';
    const params = [];

    if (filters.order_id) {
      query += ` AND order_id = $${params.length + 1}`;
      params.push(filters.order_id);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateQuotation(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (data.discount !== undefined) {
      updates.push(`discount = $${paramCount}`);
      params.push(data.discount);
      paramCount++;
    }

    if (updates.length === 0) return this.findQuotationById(id);

    params.push(id);
    const query = `UPDATE quotations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  // ===== INVOICES =====
  async createInvoice(data) {
    const query = `
      INSERT INTO invoices 
      (order_id, invoice_number, invoice_date, due_date, total_amount, payment_status)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pending')
      RETURNING *
    `;
    
    // Generate unique invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    
    const result = await db.query(query, [
      data.order_id,
      invoiceNumber,
      data.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      data.total_amount
    ]);
    return result.rows[0];
  }

  async findInvoiceById(id) {
    const query = 'SELECT * FROM invoices WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAllInvoices(filters = {}, limit = 10, offset = 0) {
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (filters.order_id) {
      query += ` AND order_id = $${params.length + 1}`;
      params.push(filters.order_id);
    }

    if (filters.payment_status) {
      query += ` AND payment_status = $${params.length + 1}`;
      params.push(filters.payment_status);
    }

    if (filters.from_date) {
      query += ` AND invoice_date >= $${params.length + 1}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      query += ` AND invoice_date <= $${params.length + 1}`;
      params.push(filters.to_date);
    }

    query += ` ORDER BY invoice_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateInvoiceStatus(id, status, paidAmount = null) {
    let query = `
      UPDATE invoices 
      SET payment_status = $1
    `;
    const params = [status, id];

    if (paidAmount !== null) {
      query += `, paid_amount = $2 WHERE id = $3`;
      params.splice(1, 1, paidAmount, id);
    } else {
      query += ` WHERE id = $2`;
    }

    query += ` RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  async updateInvoicePaidAmount(id, paidAmount) {
    const invoice = await this.findInvoiceById(id);

    if (!invoice) throw new Error('Invoice not found');

    // Determine payment status based on paid amount vs total
    let status = 'pending';
    if (paidAmount >= invoice.total_amount) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    }

    return this.updateInvoiceStatus(id, status, paidAmount);
  }

  // ===== PAYMENTS =====
  async createPayment(data) {
    const query = `
      INSERT INTO payments 
      (invoice_id, payment_method, amount, transaction_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.invoice_id,
      data.payment_method,
      data.amount,
      data.transaction_id || null,
      data.created_by || null
    ]);
    return result.rows[0];
  }

  async getPayments(invoiceId) {
    const query = `
      SELECT * FROM payments 
      WHERE invoice_id = $1
      ORDER BY payment_date DESC
    `;
    const result = await db.query(query, [invoiceId]);
    return result.rows;
  }

  async getTotalPaidAmount(invoiceId) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total_paid 
      FROM payments 
      WHERE invoice_id = $1
    `;
    const result = await db.query(query, [invoiceId]);
    return result.rows[0].total_paid;
  }
}

module.exports = new BillingRepository();
