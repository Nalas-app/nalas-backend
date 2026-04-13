const billingService = require('../../billing/service');
const billingRepository = require('../../billing/repository');
const logger = require('../../../shared/utils/logger');

const BILLING_TIMEOUT_MS = 8000;

async function withTimeout(promise, ms, errorMsg) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMsg)), ms)
    );
    return Promise.race([promise, timeout]);
}

async function createQuotationForOrder(orderId, options = {}) {
    // Check if quotation already exists (idempotency)
    const existing = await billingRepository.findQuotationByOrderId(orderId);
    if (existing) {
        logger.info(`[Billing Integration] Quotation already exists for order ${orderId}, returning existing.`);
        return existing;
    }

    logger.info(`[Billing Integration] Creating quotation for order ${orderId}`);
    try {
        const quotation = await withTimeout(
            billingService.createQuotation({
                order_id: orderId,
                labor_cost_per_guest: options.labor_cost_per_guest || 500,
                overhead_percentage: options.overhead_percentage || 10,
                tax_percentage: options.tax_percentage || 5
            }),
            BILLING_TIMEOUT_MS,
            `Quotation creation timed out for order ${orderId}`
        );
        logger.info(`[Billing Integration] Quotation ${quotation.quotation_number} created ✓`);
        return quotation;
    } catch (err) {
        logger.error(`[Billing Integration] Quotation creation failed for order ${orderId}: ${err.message}`);
        throw err;
    }
}

async function createInvoiceForOrder(orderId, dueDate) {
    logger.info(`[Billing Integration] Creating invoice for order ${orderId}`);
    try {
        const invoice = await withTimeout(
            billingService.createInvoice({ order_id: orderId, due_date: dueDate }),
            BILLING_TIMEOUT_MS,
            `Invoice creation timed out for order ${orderId}`
        );
        logger.info(`[Billing Integration] Invoice ${invoice.invoice_number} created ✓`);
        return invoice;
    } catch (err) {
        logger.error(`[Billing Integration] Invoice creation failed for order ${orderId}: ${err.message}`);
        throw err;
    }
}

module.exports = { createQuotationForOrder, createInvoiceForOrder };
