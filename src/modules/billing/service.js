const AppError = require('../../shared/errors/AppError');
const billingRepository = require('./repository');
const orderRepository = require('../orders/repository');
const menuRepository = require('../menu/repository');
const stockRepository = require('../stock/repository');
const logger = require('../../shared/utils/logger');

class BillingService {
  // Calculate ingredient cost for an order
  async calculateIngredientCost(orderId) {
    const orderItems = await orderRepository.getOrderItems(orderId);
    let totalIngredientCost = 0;

    for (const orderItem of orderItems) {
      const recipe = await menuRepository.getRecipe(orderItem.menu_item_id);

      for (const recipeItem of recipe) {
        const ingredientCost = recipeItem.quantity_per_base_unit 
          * recipeItem.wastage_factor 
          * recipeItem.current_price_per_unit 
          * orderItem.quantity;
        totalIngredientCost += ingredientCost;
      }
    }

    return totalIngredientCost;
  }

  // ===== QUOTATIONS =====
  async createQuotation(data) {
    const order = await orderRepository.findOrderById(data.order_id);

    if (!order) {
      throw AppError.notFound('Order');
    }

    // Check if quotation already exists for this order
    const existingQuotation = await billingRepository.findQuotationByOrderId(data.order_id);
    if (existingQuotation) {
      throw AppError.badRequest('Quotation already exists for this order');
    }

    // Calculate ingredient cost
    const ingredientCost = await this.calculateIngredientCost(data.order_id);

    // Calculate labour cost
    const laborCost = order.guest_count * (data.labor_cost_per_guest || 500);

    // Calculate overhead cost
    const subtotal = ingredientCost + laborCost;
    const overheadPercentage = data.overhead_percentage || 15;
    const overheadCost = (subtotal * overheadPercentage) / 100;

    // Calculate discount
    const discountAmount = data.discount || 0;

    // Calculate tax
    const taxableAmount = subtotal + overheadCost - discountAmount;
    const taxPercentage = data.tax_percentage || 18;
    const taxAmount = (taxableAmount * taxPercentage) / 100;

    // Calculate grand total
    const grandTotal = taxableAmount + taxAmount;

    const quotation = await billingRepository.createQuotation({
      order_id: data.order_id,
      subtotal,
      labor_cost: laborCost,
      overhead_cost: overheadCost,
      discount: discountAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal
    });

    return {
      id: quotation.id,
      order_id: quotation.order_id,
      quotation_number: quotation.quotation_number,
      breakdown: {
        ingredient_cost: ingredientCost,
        labor_cost: laborCost,
        subtotal,
        overhead_cost: overheadCost,
        discount: discountAmount,
        tax_amount: taxAmount
      },
      grand_total: grandTotal,
      valid_until: quotation.valid_until,
      created_at: quotation.created_at
    };
  }

  async getQuotationById(quotationId) {
    const quotation = await billingRepository.findQuotationById(quotationId);

    if (!quotation) {
      throw AppError.notFound('Quotation');
    }

    return {
      id: quotation.id,
      order_id: quotation.order_id,
      quotation_number: quotation.quotation_number,
      subtotal: quotation.subtotal,
      labor_cost: quotation.labor_cost,
      overhead_cost: quotation.overhead_cost,
      discount: quotation.discount,
      tax_amount: quotation.tax_amount,
      grand_total: quotation.grand_total,
      valid_until: quotation.valid_until,
      pdf_url: quotation.pdf_url,
      created_at: quotation.created_at
    };
  }

  async getAllQuotations(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const quotations = await billingRepository.findAllQuotations(filters, limit, offset);

    return quotations.map(q => ({
      id: q.id,
      order_id: q.order_id,
      quotation_number: q.quotation_number,
      grand_total: q.grand_total,
      valid_until: q.valid_until,
      created_at: q.created_at
    }));
  }

  // ===== INVOICES =====
  async createInvoice(data) {
    const order = await orderRepository.findOrderById(data.order_id);

    if (!order) {
      throw AppError.notFound('Order');
    }

    // Get or create quotation
    let quotation = await billingRepository.findQuotationByOrderId(data.order_id);
    if (!quotation) {
      // If no quotation exists, create one with defaults
      const quotationResult = await this.createQuotation({
        order_id: data.order_id,
        labor_cost_per_guest: 500,
        overhead_percentage: 15,
        tax_percentage: 18
      });
      quotation = await billingRepository.findQuotationByOrderId(data.order_id);
    }

    const invoice = await billingRepository.createInvoice({
      order_id: data.order_id,
      total_amount: quotation.grand_total,
      due_date: data.due_date
    });

    return {
      id: invoice.id,
      order_id: invoice.order_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      payment_status: invoice.payment_status,
      created_at: invoice.created_at
    };
  }

  async getInvoiceById(invoiceId) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);

    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    const payments = await billingRepository.getPayments(invoiceId);

    return {
      id: invoice.id,
      order_id: invoice.order_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      payment_status: invoice.payment_status,
      pending_amount: Math.max(0, invoice.total_amount - (invoice.paid_amount || 0)),
      pdf_url: invoice.pdf_url,
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.payment_method,
        date: p.payment_date
      })),
      created_at: invoice.created_at
    };
  }

  async getAllInvoices(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const invoices = await billingRepository.findAllInvoices(filters, limit, offset);

    return invoices.map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      order_id: inv.order_id,
      invoice_date: inv.invoice_date,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount || 0,
      payment_status: inv.payment_status,
      pending_amount: Math.max(0, inv.total_amount - (inv.paid_amount || 0))
    }));
  }

  // ===== PAYMENTS =====
  async recordPayment(data, userId) {
    const invoice = await billingRepository.findInvoiceById(data.invoice_id);

    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    if (invoice.payment_status === 'paid') {
      throw AppError.badRequest('Invoice is already fully paid');
    }

    const payment = await billingRepository.createPayment({
      ...data,
      created_by: userId
    });

    // Update invoice paid amount
    const totalPaid = await billingRepository.getTotalPaidAmount(data.invoice_id);
    const newPaidAmount = totalPaid + data.amount;
    const updatedInvoice = await billingRepository.updateInvoicePaidAmount(data.invoice_id, newPaidAmount);

    return {
      id: payment.id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_id: payment.transaction_id,
      invoice_status: updatedInvoice.payment_status,
      total_paid: newPaidAmount,
      pending_amount: Math.max(0, invoice.total_amount - newPaidAmount),
      payment_date: payment.payment_date
    };
  }

  async getPayments(invoiceId) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);

    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    const payments = await billingRepository.getPayments(invoiceId);

    return payments.map(p => ({
      id: p.id,
      amount: p.amount,
      payment_method: p.payment_method,
      transaction_id: p.transaction_id,
      payment_date: p.payment_date
    }));
  }

  // ===== REFUNDS =====
  async processRefund(data, userId) {
    const invoice = await billingRepository.findInvoiceById(data.invoice_id);

    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    const paidAmount = Number(invoice.paid_amount || 0);
    const refundAmount = Number(data.amount);

    if (paidAmount <= 0) {
      throw AppError.badRequest('No payments recorded on this invoice to refund');
    }

    if (refundAmount > paidAmount) {
      throw AppError.badRequest(
        `Refund amount (${refundAmount}) exceeds total paid (${paidAmount})`,
        { paid_amount: paidAmount, requested_refund: refundAmount }
      );
    }

    // Create refund record as a negative payment
    const refund = await billingRepository.createPayment({
      invoice_id: data.invoice_id,
      payment_method: data.payment_method || 'bank_transfer',
      amount: -refundAmount,
      transaction_id: data.transaction_id || `REFUND-${Date.now()}`,
      created_by: userId
    });

    // Update invoice paid amount
    const newPaidAmount = Math.max(0, paidAmount - refundAmount);
    const updatedInvoice = await billingRepository.updateInvoicePaidAmount(
      data.invoice_id,
      newPaidAmount
    );

    logger.info(`Refund of ${refundAmount} processed for invoice ${data.invoice_id} by user ${userId}`);

    return {
      refund_id: refund.id,
      invoice_id: data.invoice_id,
      refund_amount: refundAmount,
      reason: data.reason || 'Order cancellation',
      invoice_status: updatedInvoice.payment_status,
      remaining_paid: newPaidAmount,
      refunded_at: refund.payment_date
    };
  }
}

module.exports = new BillingService();
