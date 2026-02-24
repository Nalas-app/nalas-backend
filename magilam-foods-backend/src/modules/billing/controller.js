const billingService = require('./service');

class BillingController {
  // ===== QUOTATIONS =====
  async createQuotation(req, res, next) {
    try {
      const result = await billingService.createQuotation(req.body);

      res.status(201).json({
        success: true,
        message: 'Quotation generated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuotation(req, res, next) {
    try {
      const result = await billingService.getQuotationById(req.params.id);

      res.json({
        success: true,
        message: 'Quotation retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listQuotations(req, res, next) {
    try {
      const { order_id, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (order_id) filters.order_id = order_id;

      const result = await billingService.getAllQuotations(filters, page, limit);

      res.json({
        success: true,
        message: 'Quotations retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== INVOICES =====
  async createInvoice(req, res, next) {
    try {
      const result = await billingService.createInvoice(req.body);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvoice(req, res, next) {
    try {
      const result = await billingService.getInvoiceById(req.params.id);

      res.json({
        success: true,
        message: 'Invoice retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listInvoices(req, res, next) {
    try {
      const { order_id, payment_status, from_date, to_date, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (order_id) filters.order_id = order_id;
      if (payment_status) filters.payment_status = payment_status;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;

      const result = await billingService.getAllInvoices(filters, page, limit);

      res.json({
        success: true,
        message: 'Invoices retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== PAYMENTS =====
  async recordPayment(req, res, next) {
    try {
      const result = await billingService.recordPayment(req.body, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req, res, next) {
    try {
      const result = await billingService.getPayments(req.params.id);

      res.json({
        success: true,
        message: 'Payments retrieved successfully',
        data: result,
        count: result.length
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BillingController();
