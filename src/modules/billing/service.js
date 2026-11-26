const AppError = require('../../shared/errors/AppError');
const billingRepository = require('./repository');
const orderRepository = require('../orders/repository');
const menuRepository = require('../menu/repository');
const stockRepository = require('../stock/repository');
const settingsRepository = require('../settings/repository');
const qrService = require('./qr.service');
const logger = require('../../shared/utils/logger');
const {
  toFiniteNumber,
  roundCurrency,
  resolveDishUnitCost
} = require('../../shared/utils/dishCost');

class BillingService {
  async _loadQuotationConfig() {
    try {
      const configRow = await settingsRepository.getSetting('quotation_config');
      return configRow?.value || {};
    } catch (err) {
      logger.warn(`Failed to load quotation_config from app_settings, using defaults: ${err.message}`);
      return {};
    }
  }

  // Calculate dish/ingredient cost for an order (with fallback for items without mapped recipes)
  async calculateIngredientCost(orderId, { syncOrderItemPrices = false } = {}) {
    const orderItems = await orderRepository.getOrderItems(orderId);
    let totalIngredientCost = 0;

    for (const orderItem of orderItems) {
      let recipe = [];
      try {
        recipe = await menuRepository.getRecipe(orderItem.menu_item_id);
      } catch (err) {
        logger.warn(`Failed to fetch recipe for item ${orderItem.menu_item_id}: ${err.message}`);
      }

      const qty = toFiniteNumber(orderItem.quantity, 0);
      const { unitCost } = resolveDishUnitCost({
        item: orderItem,
        recipeRows: recipe,
        ignoreLegacyPlaceholder: true
      });
      const itemCost = roundCurrency(unitCost * qty);
      totalIngredientCost = roundCurrency(totalIngredientCost + itemCost);

      if (syncOrderItemPrices && orderItem.id && toFiniteNumber(orderItem.unit_price, 0) !== unitCost) {
        try {
          await orderRepository.updateOrderItemPricing(orderItem.id, unitCost, itemCost);
        } catch (err) {
          logger.warn(`Failed to sync unit_price on order_item ${orderItem.id}: ${err.message}`);
        }
      }
    }

    return totalIngredientCost;
  }

  async _buildQuotationBreakdown(quotation) {
    const cfg = await this._loadQuotationConfig();
    let guestCount = 100;
    try {
      const order = await orderRepository.findOrderById(quotation.order_id);
      if (order && toFiniteNumber(order.guest_count, 0) > 0) {
        guestCount = toFiniteNumber(order.guest_count, 100);
      }
    } catch (err) {
      // Non-critical fallback
    }

    const lpgPerGuest         = toFiniteNumber(cfg.lpg_cost_per_guest, 30);
    const transportFlat       = toFiniteNumber(cfg.transport_flat, 1000);
    const leafPerGuest        = toFiniteNumber(cfg.leaf_cost_per_guest, 10);
    const disposablesPerGuest = toFiniteNumber(cfg.disposables_cost_per_guest, 20);
    const overheadPct         = toFiniteNumber(cfg.overhead_percentage, 10);
    const gstPct              = toFiniteNumber(cfg.gst_percentage, 18);

    const labourCost      = roundCurrency(toFiniteNumber(quotation.labor_cost, 0));
    const lpgCost         = roundCurrency(lpgPerGuest * guestCount);
    const leafCost        = roundCurrency(leafPerGuest * guestCount);
    const disposablesCost = roundCurrency(disposablesPerGuest * guestCount);
    const overheadCost    = roundCurrency(toFiniteNumber(quotation.overhead_cost, 0));
    const discountAmount  = roundCurrency(toFiniteNumber(quotation.discount, 0));
    const taxAmount       = roundCurrency(toFiniteNumber(quotation.tax_amount, 0));
    const grandTotal      = roundCurrency(toFiniteNumber(quotation.grand_total, 0));
    const storedSubtotal  = roundCurrency(toFiniteNumber(quotation.subtotal, 0));

    const sellingPrice = roundCurrency(grandTotal - taxAmount + discountAmount);

    // Detect legacy rows where sellingPrice (including overhead + profit) was stored in subtotal
    const isLegacySellingPriceSubtotal =
      overheadCost > 0 && Math.abs(storedSubtotal - sellingPrice) < 1;

    const rawSubtotal = isLegacySellingPriceSubtotal
      ? (overheadPct > 0 ? roundCurrency((overheadCost * 100) / overheadPct) : Math.max(0, roundCurrency(storedSubtotal - overheadCost)))
      : storedSubtotal;

    const fixedCharges = roundCurrency(labourCost + lpgCost + transportFlat + leafCost + disposablesCost);
    const ingredientCost = roundCurrency(Math.max(0, rawSubtotal - fixedCharges));
    const profitAmount = roundCurrency(Math.max(0, sellingPrice - rawSubtotal - overheadCost));
    const applyGst = taxAmount > 0;

    return {
      ingredient_cost:  ingredientCost,
      labour_cost:      labourCost,
      lpg_cost:         lpgCost,
      transport_cost:   transportFlat,
      leaf_cost:        leafCost,
      disposables_cost: disposablesCost,
      raw_subtotal:     rawSubtotal,
      overhead_cost:    overheadCost,
      profit_amount:    profitAmount,
      selling_price:    sellingPrice,
      discount:         discountAmount,
      gst_applied:      applyGst,
      gst_percentage:   applyGst ? gstPct : 0,
      tax_amount:       taxAmount
    };
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

    // Load config from app_settings (fallback to safe defaults)
    const cfg = await this._loadQuotationConfig();

    const labourPerGuest      = toFiniteNumber(data.labour_cost_per_guest ?? data.labor_cost_per_guest, toFiniteNumber(cfg.labour_cost_per_guest, 500));
    const lpgPerGuest         = toFiniteNumber(data.lpg_cost_per_guest, toFiniteNumber(cfg.lpg_cost_per_guest, 30));
    const transportFlat       = toFiniteNumber(data.transport_flat, toFiniteNumber(cfg.transport_flat, 1000));
    const leafPerGuest        = toFiniteNumber(data.leaf_cost_per_guest, toFiniteNumber(cfg.leaf_cost_per_guest, 10));
    const disposablesPerGuest = toFiniteNumber(data.disposables_cost_per_guest, toFiniteNumber(cfg.disposables_cost_per_guest, 20));
    const overheadPct         = toFiniteNumber(data.overhead_percentage, toFiniteNumber(cfg.overhead_percentage, 10));
    const profitPct           = toFiniteNumber(data.profit_percentage, toFiniteNumber(cfg.profit_percentage, 25));
    const gstPct              = toFiniteNumber(data.gst_percentage ?? data.tax_percentage, toFiniteNumber(cfg.gst_percentage, 18));
    const applyGst            = Boolean(data.apply_gst);
    const guestCount          = toFiniteNumber(order.guest_count, 100);

    // ── Food / dish ingredient cost ───────────────────────────────────────
    const explicitDishCost = data.dish_cost ?? data.ml_ingredient_cost;
    const ingredientCost = (explicitDishCost !== undefined && explicitDishCost !== null)
      ? roundCurrency(toFiniteNumber(explicitDishCost, 0))
      : await this.calculateIngredientCost(data.order_id, { syncOrderItemPrices: true });

    // ── Per-guest variable costs ──────────────────────────────────────────
    const labourCost      = roundCurrency(labourPerGuest      * guestCount);
    const lpgCost         = roundCurrency(lpgPerGuest         * guestCount);
    const leafCost        = roundCurrency(leafPerGuest        * guestCount);
    const disposablesCost = roundCurrency(disposablesPerGuest * guestCount);

    // ── Raw subtotal before overhead & profit ─────────────────────────────
    const rawSubtotal = roundCurrency(
      ingredientCost + labourCost + lpgCost + transportFlat + leafCost + disposablesCost
    );

    // ── Overhead ──────────────────────────────────────────────────────────
    const overheadCost = roundCurrency((rawSubtotal * overheadPct) / 100);

    // ── Subtotal after overhead ───────────────────────────────────────────
    const subtotal = roundCurrency(rawSubtotal + overheadCost);

    // ── Profit (on subtotal after overhead) ───────────────────────────────
    const profitAmount = roundCurrency((subtotal * profitPct) / 100);

    // ── Selling price (before discount & GST) ─────────────────────────────
    const sellingPrice = roundCurrency(subtotal + profitAmount);

    // ── Discount ─────────────────────────────────────────────────────────
    const discountAmount = roundCurrency(toFiniteNumber(data.discount, 0));
    const afterDiscount  = roundCurrency(Math.max(0, sellingPrice - discountAmount));

    // ── GST ───────────────────────────────────────────────────────────────
    const taxAmount  = applyGst ? roundCurrency((afterDiscount * gstPct) / 100) : 0;
    const grandTotal = roundCurrency(afterDiscount + taxAmount);

    const quotation = await billingRepository.createQuotation({
      order_id:      data.order_id,
      subtotal:      rawSubtotal,         // store true pre-overhead/pre-profit subtotal
      labor_cost:    labourCost,
      overhead_cost: overheadCost,
      discount:      discountAmount,
      tax_amount:    taxAmount,
      grand_total:   grandTotal
    });

    // Keep orders.total_amount synchronized regardless of whether quotation was minted
    // via POST /billing/quotations or POST /orders/:id/quotation
    try {
      await orderRepository.updateTotalAmount(data.order_id, grandTotal);
    } catch (err) {
      logger.warn(`Failed to sync total_amount on order ${data.order_id}: ${err.message}`);
    }

    return {
      id:               quotation.id,
      order_id:         quotation.order_id,
      quotation_number: quotation.quotation_number,
      subtotal:         rawSubtotal,
      labor_cost:       labourCost,
      overhead_cost:    overheadCost,
      discount:         discountAmount,
      tax_amount:       taxAmount,
      breakdown: {
        ingredient_cost:   ingredientCost,
        labour_cost:       labourCost,
        lpg_cost:          lpgCost,
        transport_cost:    transportFlat,
        leaf_cost:         leafCost,
        disposables_cost:  disposablesCost,
        raw_subtotal:      rawSubtotal,
        overhead_cost:     overheadCost,
        profit_amount:     profitAmount,
        selling_price:     sellingPrice,
        discount:          discountAmount,
        gst_applied:       applyGst,
        gst_percentage:    applyGst ? gstPct : 0,
        tax_amount:        taxAmount
      },
      grand_total:  grandTotal,
      valid_until:  quotation.valid_until,
      created_at:   quotation.created_at
    };
  }

  async getQuotationById(quotationId) {
    const quotation = await billingRepository.findQuotationById(quotationId);

    if (!quotation) {
      throw AppError.notFound('Quotation');
    }

    const breakdown = await this._buildQuotationBreakdown(quotation);

    return {
      id: quotation.id,
      order_id: quotation.order_id,
      quotation_number: quotation.quotation_number,
      subtotal: breakdown.raw_subtotal,
      labor_cost: quotation.labor_cost,
      overhead_cost: quotation.overhead_cost,
      discount: quotation.discount,
      tax_amount: quotation.tax_amount,
      breakdown,
      grand_total: quotation.grand_total,
      valid_until: quotation.valid_until,
      pdf_url: quotation.pdf_url,
      created_at: quotation.created_at
    };
  }

  async getAllQuotations(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const quotations = await billingRepository.findAllQuotations(filters, limit, offset);

    return Promise.all(quotations.map(async (q) => {
      const breakdown = await this._buildQuotationBreakdown(q);
      return {
        id: q.id,
        order_id: q.order_id,
        quotation_number: q.quotation_number,
        subtotal: breakdown.raw_subtotal,
        ingredient_cost: breakdown.ingredient_cost,
        labor_cost: q.labor_cost,
        overhead_cost: q.overhead_cost,
        tax_amount: q.tax_amount,
        breakdown,
        grand_total: q.grand_total,
        valid_until: q.valid_until,
        created_at: q.created_at
      };
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
      // If no quotation exists, create one using configured settings + real dish costs
      await this.createQuotation({
        order_id: data.order_id
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
  async _resolveInvoiceOrFromQuotationId(invoiceOrQuotationId) {
    let invoice = await billingRepository.findInvoiceById(invoiceOrQuotationId);
    if (!invoice) {
      const quotation = await billingRepository.findQuotationById(invoiceOrQuotationId);
      if (quotation) {
        invoice = await billingRepository.findInvoiceByOrderId(quotation.order_id);
      }
    }
    return invoice;
  }

  async recordPayment(data, userId) {
    const invoice = await this._resolveInvoiceOrFromQuotationId(data.invoice_id);

    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    if (invoice.payment_status === 'paid') {
      throw AppError.badRequest('Invoice is already fully paid');
    }

    const payment = await billingRepository.createPayment({
      ...data,
      invoice_id: invoice.id,
      created_by: userId
    });

    // Update invoice paid amount
    const totalPaid = await billingRepository.getTotalPaidAmount(invoice.id);
    const updatedInvoice = await billingRepository.updateInvoicePaidAmount(invoice.id, Number(totalPaid));

    try {
      await orderRepository.updateAdvancePaid(invoice.order_id, Number(totalPaid));
    } catch (err) {
      logger.warn(`Failed to sync advance_paid on order ${invoice.order_id}: ${err.message}`);
    }

    return {
      id: payment.id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_id: payment.transaction_id,
      invoice_status: updatedInvoice.payment_status,
      total_paid: Number(totalPaid),
      pending_amount: Math.max(0, invoice.total_amount - Number(totalPaid)),
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
    const totalPaid = await billingRepository.getTotalPaidAmount(data.invoice_id);
    const updatedInvoice = await billingRepository.updateInvoicePaidAmount(
      data.invoice_id,
      Number(totalPaid)
    );

    try {
      await orderRepository.updateAdvancePaid(invoice.order_id, Number(totalPaid));
    } catch (err) {
      logger.warn(`Failed to sync advance_paid on order ${invoice.order_id}: ${err.message}`);
    }

    logger.info(`Refund of ${refundAmount} processed for invoice ${data.invoice_id} by user ${userId}`);

    return {
      refund_id: refund.id,
      invoice_id: data.invoice_id,
      refund_amount: refundAmount,
      reason: data.reason || 'Order cancellation',
      invoice_status: updatedInvoice.payment_status,
      remaining_paid: Number(totalPaid),
      refunded_at: refund.payment_date
    };
  }

  // ===== UPI QR CODE =====
  async getInvoiceQR(invoiceId) {
    const invoice = await this._resolveInvoiceOrFromQuotationId(invoiceId);
    if (!invoice) throw AppError.notFound('Invoice');

    const businessRow = await settingsRepository.getSetting('business_info');
    const biz = businessRow?.value || {};

    if (!biz.upi_id) {
      throw AppError.badRequest('UPI ID not configured. Please set it in Settings → Business Info.');
    }

    const pendingAmount = Math.max(0, invoice.total_amount - (invoice.paid_amount || 0));
    const qrBase64 = await qrService.generateUPIQR({
      upiId:      biz.upi_id,
      payeeName:  biz.upi_payee_name || biz.business_name || 'Magilam Foods',
      amount:     pendingAmount,
      note:       invoice.invoice_number
    });

    return {
      invoice_id:     invoice.id,
      invoice_number: invoice.invoice_number,
      amount:         pendingAmount,
      upi_id:         biz.upi_id,
      qr_base64:      qrBase64,
      qr_data_url:    `data:image/png;base64,${qrBase64}`
    };
  }

  async getBlankQR() {
    const businessRow = await settingsRepository.getSetting('business_info');
    const biz = businessRow?.value || {};

    if (!biz.upi_id) {
      throw AppError.badRequest('UPI ID not configured. Please set it in Settings → Business Info.');
    }

    const qrBase64 = await qrService.generateBlankUPIQR({
      upiId:     biz.upi_id,
      payeeName: biz.upi_payee_name || biz.business_name || 'Magilam Foods'
    });

    return {
      upi_id:      biz.upi_id,
      qr_base64:   qrBase64,
      qr_data_url: `data:image/png;base64,${qrBase64}`
    };
  }
}

module.exports = new BillingService();
