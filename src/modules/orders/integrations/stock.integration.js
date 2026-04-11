// src/modules/orders/integrations/stock.integration.js
const stockService = require('../../stock/service');
const logger = require('../../../shared/utils/logger');

const STOCK_TIMEOUT_MS = 5000;

async function withTimeout(promise, ms, errorMsg) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMsg)), ms)
    );
    return Promise.race([promise, timeout]);
}

async function reserveStockForOrder(orderId, ingredientNeeds) {
    const reserved = [];
    try {
        for (const [ingredientId, need] of Object.entries(ingredientNeeds)) {
            logger.info(`[Stock Integration] Reserving ${need.quantity} of ${ingredientId} for order ${orderId}`);

            await withTimeout(
                stockService.reserveStock(ingredientId, need.quantity),
                STOCK_TIMEOUT_MS,
                `Stock reservation timed out for ingredient ${ingredientId}`
            );

            reserved.push({ ingredient_id: ingredientId, quantity: need.quantity });
            logger.info(`[Stock Integration] Reserved ${need.quantity} of ${ingredientId} ✓`);
        }
        return reserved;
    } catch (err) {
        // Rollback already-reserved stock
        logger.error(`[Stock Integration] Reservation failed for order ${orderId}: ${err.message}. Rolling back ${reserved.length} reservations.`);
        for (const r of reserved) {
            try {
                await stockService.releaseReservedStock(r.ingredient_id, r.quantity);
                logger.info(`[Stock Integration] Rolled back ${r.quantity} of ${r.ingredient_id}`);
            } catch (rollbackErr) {
                logger.error(`[Stock Integration] CRITICAL: Rollback failed for ${r.ingredient_id}: ${rollbackErr.message}`);
            }
        }
        throw err; // re-throw so the caller knows it failed
    }
}

async function releaseStockForOrder(orderId, reservations) {
    for (const r of reservations) {
        try {
            const qty = Number(r.reserved_quantity || r.quantity);
            await withTimeout(
                stockService.releaseReservedStock(r.ingredient_id, qty),
                STOCK_TIMEOUT_MS,
                `Stock release timed out for ingredient ${r.ingredient_id}`
            );
            logger.info(`[Stock Integration] Released ${qty} of ${r.ingredient_id} for order ${orderId}`);
        } catch (err) {
            logger.error(`[Stock Integration] Failed to release stock for ${r.ingredient_id}: ${err.message}`);
        }
    }
}

module.exports = { reserveStockForOrder, releaseStockForOrder };
