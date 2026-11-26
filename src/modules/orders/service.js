const axios = require('axios');
const AppError = require('../../shared/errors/AppError');
const orderRepository = require('./repository');
const billingService = require('../billing/service');
const stockService = require('../stock/service');
const menuRepository = require('../menu/repository');
const mlCostingRepository = require('../ml-costing/repository');
const logger = require('../../shared/utils/logger');
const mlClient = require('../../shared/utils/mlClient');
const {
  MAX_SANE_UNIT_COST,
  toFiniteNumber,
  roundCurrency,
  computeRecipeUnitCost,
  estimateDishUnitCost,
  resolveDishUnitCost
} = require('../../shared/utils/dishCost');

class OrderService {
  async _resolveItemCreationUnitPrice(menuItem, rawItemPrice) {
    let recipe = [];
    try {
      recipe = await menuRepository.getRecipe(menuItem.id);
    } catch (err) {
      logger.warn(`Could not load recipe during order creation for item ${menuItem.id}: ${err.message}`);
    }

    const { unitCost } = resolveDishUnitCost({
      item: menuItem,
      recipeRows: recipe,
      explicitRequestPrice: rawItemPrice,
      ignoreLegacyPlaceholder: false
    });
    return unitCost;
  }

  async createOrder(customerId, orderData) {
    // Validate order items exist and retrieve menu items
    const order = await orderRepository.createOrder(customerId, {
      event_date: orderData.event_date,
      event_time: orderData.event_time,
      event_type: orderData.event_type,
      guest_count: orderData.guest_count,
      venue_address: orderData.venue_address
    });

    if (!order) {
      throw AppError.internal('Failed to create order');
    }

    // Add order items and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of orderData.order_items) {
      // Validate against minimum quantity
      const menuItem = await menuRepository.findMenuItemById(item.menu_item_id);
      if (!menuItem) {
        throw AppError.notFound(`Menu item not found: ${item.menu_item_id}`);
      }

      if (Number(item.quantity) < Number(menuItem.min_quantity)) {
        throw AppError.badRequest(
          `Minimum quantity for ${menuItem.name} is ${menuItem.min_quantity}. You requested ${item.quantity}.`
        );
      }

      const unitPrice = await this._resolveItemCreationUnitPrice(menuItem, item.unit_price);
      const itemTotal = roundCurrency(Number(item.quantity) * unitPrice);
      totalAmount = roundCurrency(totalAmount + itemTotal);

      const orderItem = await orderRepository.createOrderItem(
        order.id,
        item.menu_item_id,
        item.quantity,
        unitPrice,
        item.customizations
      );

      orderItems.push(orderItem);
    }

    // Update order total
    await orderRepository.updateTotalAmount(order.id, totalAmount);

    // Log initial status
    try {
      await orderRepository.logStatusChange(order.id, null, 'draft', customerId, 'Order created');
    } catch (err) {
      // Non-critical: don't fail order creation if history logging fails
      logger.error('Failed to log status change:', err.message);
    }

    return {
      id: order.id,
      customer_id: order.customer_id,
      event_date: order.event_date,
      event_time: order.event_time,
      event_type: order.event_type,
      guest_count: order.guest_count,
      venue_address: order.venue_address,
      status: order.status,
      total_amount: totalAmount,
      items: orderItems,
      created_at: order.created_at
    };
  }

  // ===== QUOTATION GENERATION (Order → Billing integration) =====
  async generateQuotation(orderId, userId, options = {}) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    if (order.status !== 'draft') {
      throw AppError.badRequest(
        'Quotation can only be generated for draft orders',
        { current_status: order.status }
      );
    }

    const orderItems = await orderRepository.getOrderItems(orderId);

    if (!orderItems.length) {
      throw AppError.badRequest('Order has no items');
    }

    // Calculate raw dish/ingredient costs per item — Recipe-based first (deterministic, auditable),
    // then ML raw ingredientCost (without double-counting ML labor/overhead), then per-dish unit cost.
    let subtotal = 0;
    let isMlPredicted = false;
    let mlConfidenceSum = 0;
    let mlCount = 0;
    const itemBreakdown = [];
    let mlFallbackReason = null;

    for (const item of orderItems) {
      const qty = toFiniteNumber(item.quantity, 0);
      let unitCost = 0;
      let itemCost = 0;
      let predictionData = null;
      let method = 'recipe_calculation';

      // 1. PRIMARY: Recipe-based calculation (deterministic, auditable, legally defensible)
      try {
        const recipe = await menuRepository.getRecipe(item.menu_item_id);
        const recipeUnitCost = computeRecipeUnitCost(recipe);

        if (recipeUnitCost > 0) {
          unitCost = recipeUnitCost;
          itemCost = roundCurrency(recipeUnitCost * qty);
          method = 'recipe_calculation';
          logger.info(`Recipe calculation used for item ${item.menu_item_id}: cost=${itemCost}`);
        }
      } catch (recipeErr) {
        logger.error(`Recipe calculation failed for item ${item.menu_item_id}:`, recipeErr.message);
      }

      // 2. FALLBACK: ML prediction — only when recipe data is missing or returned zero
      if (itemCost <= 0) {
        logger.warn(`No priced recipe data for item ${item.menu_item_id}, attempting ML prediction as fallback`);
        try {
          predictionData = await mlClient.predictCost({
            menuItemId: item.menu_item_id,
            quantity: qty,
            eventDate: order.event_date,
            guestCount: order.guest_count
          });

          const mlRawIngredientCost = toFiniteNumber(predictionData?.ingredientCost, 0);
          const mlPerUnit = qty > 0 ? mlRawIngredientCost / qty : 0;
          const maxReasonableForDish = Math.min(MAX_SANE_UNIT_COST, estimateDishUnitCost(item) * 5);
          const isSaneMlCost =
            mlRawIngredientCost > 0 &&
            mlPerUnit > 0 &&
            (predictionData?.method === 'rule_based'
              ? mlPerUnit <= MAX_SANE_UNIT_COST
              : mlPerUnit <= maxReasonableForDish);

          if (predictionData && isSaneMlCost) {
            unitCost = roundCurrency(mlPerUnit);
            itemCost = roundCurrency(mlRawIngredientCost);
            isMlPredicted = true;
            mlCount++;
            mlConfidenceSum += toFiniteNumber(predictionData.confidence, 0);
            method = 'ml_prediction';

            // Log ML prediction to DB for evaluation
            await mlCostingRepository.createPrediction({
              order_item_id: item.id,
              ingredient_cost: predictionData.ingredientCost,
              labor_cost: predictionData.laborCost,
              overhead_cost: predictionData.overheadCost,
              predicted_total: predictionData.totalCost,
              model_version: predictionData.modelVersion,
              prediction_confidence: predictionData.confidence
            });
          } else if (predictionData) {
            mlFallbackReason = `ML returned unusable ingredientCost=${predictionData.ingredientCost} for item ${item.menu_item_id}`;
            logger.warn(`ML returned zero/outlier cost for item ${item.menu_item_id}:`, predictionData);
          }
        } catch (err) {
          const status = err.response?.status;
          const body = err.response?.data ? JSON.stringify(err.response.data) : null;
          mlFallbackReason = status
            ? `ML service returned HTTP ${status}: ${body || err.message}`
            : `ML service unreachable: ${err.message}`;
          logger.warn(`ML fallback also failed for item ${item.menu_item_id}: ${mlFallbackReason}`);
        }
      }

      // 3. DISH COST FALLBACK: real item unit_price or category-based dish estimate (never 0)
      if (itemCost <= 0) {
        const resolved = resolveDishUnitCost({
          item,
          recipeRows: [],
          ignoreLegacyPlaceholder: true
        });
        unitCost = resolved.unitCost;
        itemCost = roundCurrency(unitCost * qty);
        method = resolved.method;
        logger.info(`Dish cost fallback (${method}) applied for item ${item.menu_item_id}: unit=${unitCost}, total=${itemCost}`);
      }

      if (item.id && toFiniteNumber(item.unit_price, 0) !== unitCost) {
        try {
          await orderRepository.updateOrderItemPricing(item.id, unitCost, itemCost);
        } catch (updateErr) {
          logger.warn(`Failed to sync unit_price on order_item ${item.id}: ${updateErr.message}`);
        }
      }

      subtotal = roundCurrency(subtotal + itemCost);
      itemBreakdown.push({
        menu_item_id: item.menu_item_id,
        name: item.name,
        quantity: qty,
        unit_cost: unitCost,
        calculated_cost: itemCost,
        method
      });
    }

    const avgConfidence = mlCount > 0 ? (mlConfidenceSum / mlCount).toFixed(2) : null;

    // Create quotation via billing service — ALWAYS pass the computed dish/ingredient cost
    // so orders without recipes or ML coverage never collapse to 0 dish cost.
    const quotation = await billingService.createQuotation({
      ...options,
      order_id: orderId,
      dish_cost: subtotal,
      ml_ingredient_cost: subtotal
    });

    // Update order status to 'quoted'
    const updatedOrder = await orderRepository.updateOrderStatus(orderId, 'quoted');

    // Update order total_amount to match quotation grand_total
    await orderRepository.updateTotalAmount(orderId, quotation.grand_total);

    // Log status change
    try {
      await orderRepository.logStatusChange(
        orderId, 'draft', 'quoted', userId,
        `Quotation ${quotation.quotation_number} generated`
      );
    } catch (err) {
      logger.error('Failed to log status change:', err.message);
    }

    return {
      order_id: orderId,
      quotation: quotation,
      item_breakdown: itemBreakdown,
      // is_ml_predicted=true means at least one item had no recipe and ML was used as fallback.
      // Normal (fully recipe-based) quotations will have is_ml_predicted=false.
      is_ml_predicted: isMlPredicted,
      ml_confidence: avgConfidence ? parseFloat(avgConfidence) : null,
      // ml_fallback_reason is only set when ML itself was also attempted but failed (i.e. recipe was missing AND ML failed)
      ml_fallback_reason: mlFallbackReason || null,
      status: updatedOrder.status
    };
  }

  // ===== ORDER CONFIRMATION (Order → Stock → Billing integration) =====
  async confirmOrder(orderId, userId, user = null) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    if (user && user.role === 'customer' && order.customer_id !== user.id) {
      throw AppError.forbidden('You do not have permission to confirm this order');
    }

    if (order.status !== 'quoted') {
      throw AppError.badRequest(
        'Order can only be confirmed when in quoted status',
        { current_status: order.status }
      );
    }

    // Verify quotation exists and is valid
    let quotation;
    try {
      const billingRepository = require('../billing/repository');
      quotation = await billingRepository.findQuotationByOrderId(orderId);
    } catch (err) {
      throw AppError.internal('Failed to retrieve quotation');
    }

    if (!quotation) {
      throw AppError.badRequest('No quotation found. Generate a quotation first.');
    }

    if (quotation.valid_until && new Date(quotation.valid_until) < new Date()) {
      throw AppError.badRequest('Quotation has expired. Please generate a new quotation.');
    }

    // Calculate required ingredients from recipes
    const orderItems = await orderRepository.getOrderItems(orderId);
    const ingredientNeeds = {};

    for (const item of orderItems) {
      const recipe = await menuRepository.getRecipe(item.menu_item_id);

      for (const r of recipe) {
        const neededQty = r.quantity_per_base_unit * item.quantity * (r.wastage_factor || 1.0);
        if (ingredientNeeds[r.ingredient_id]) {
          ingredientNeeds[r.ingredient_id].quantity += neededQty;
        } else {
          ingredientNeeds[r.ingredient_id] = {
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredient_name,
            unit: r.unit,
            quantity: neededQty
          };
        }
      }
    }

    // Reserve stock for all ingredients (all-or-nothing)
    const reservedIngredients = [];
    try {
      for (const [ingredientId, need] of Object.entries(ingredientNeeds)) {
        const result = await stockService.reserveStock(ingredientId, need.quantity);
        reservedIngredients.push({
          ingredient_id: ingredientId,
          quantity: need.quantity
        });

        // Save reservation record for future release
        await orderRepository.saveStockReservation(orderId, ingredientId, need.quantity);
      }
    } catch (stockError) {
      // Rollback: release any already-reserved stock
      for (const reserved of reservedIngredients) {
        try {
          await stockService.releaseReservedStock(reserved.ingredient_id, reserved.quantity);
        } catch (rollbackError) {
          logger.error(
            `CRITICAL: Failed to rollback stock reservation for ingredient ${reserved.ingredient_id}:`,
            rollbackError.message
          );
        }
      }
      // Clean up reservation records
      try {
        await orderRepository.deleteStockReservations(orderId);
      } catch (cleanupError) {
        logger.error('Failed to clean up reservation records:', cleanupError.message);
      }

      throw AppError.badRequest(
        `Insufficient stock: ${stockError.message}`,
        { order_id: orderId }
      );
    }

    // Create invoice via billing service
    let invoice;
    try {
      invoice = await billingService.createInvoice({
        order_id: orderId,
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (invoiceError) {
      // Compensating transaction: release all reserved stock
      logger.error('Invoice creation failed, rolling back stock reservations:', invoiceError.message);

      for (const reserved of reservedIngredients) {
        try {
          await stockService.releaseReservedStock(reserved.ingredient_id, reserved.quantity);
        } catch (rollbackError) {
          logger.error(
            `CRITICAL: Failed to rollback stock for ingredient ${reserved.ingredient_id}:`,
            rollbackError.message
          );
        }
      }
      await orderRepository.deleteStockReservations(orderId);

      throw AppError.internal('Order confirmation failed: could not generate invoice');
    }

    // Update order status to 'confirmed'
    const updatedOrder = await orderRepository.updateOrderStatus(orderId, 'confirmed');

    // Log status change
    try {
      await orderRepository.logStatusChange(
        orderId, 'quoted', 'confirmed', userId,
        `Stock reserved for ${reservedIngredients.length} ingredients. Invoice ${invoice.invoice_number} created.`
      );
    } catch (err) {
      logger.error('Failed to log status change:', err.message);
    }

    return {
      order_id: orderId,
      status: updatedOrder.status,
      invoice: invoice,
      stock_reservations: reservedIngredients.map(r => ({
        ingredient_id: r.ingredient_id,
        reserved_quantity: r.quantity
      })),
      confirmed_at: updatedOrder.updated_at
    };
  }

  async getOrderById(orderId, userId = null) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    const items = await orderRepository.getOrderItems(orderId);

    // Fetch status history (non-critical)
    let statusHistory = [];
    try {
      statusHistory = await orderRepository.getStatusHistory(orderId);
    } catch (err) {
      // Table may not exist yet; don't fail the request
    }

    // Fetch invoice and quotation if they exist (non-critical)
    let invoice = null;
    let quotation = null;
    try {
      const billingRepository = require('../billing/repository');
      const inv = await billingRepository.findInvoiceByOrderId(orderId);
      if (inv) {
        invoice = {
          id: inv.id,
          invoice_number: inv.invoice_number,
          total_amount: inv.total_amount,
          paid_amount: inv.paid_amount || 0,
          payment_status: inv.payment_status,
          due_date: inv.due_date
        };
      }
      const quot = await billingRepository.findQuotationByOrderId(orderId);
      if (quot) {
        quotation = {
          id: quot.id,
          quotation_number: quot.quotation_number,
          subtotal: quot.subtotal,
          labor_cost: quot.labor_cost,
          overhead_cost: quot.overhead_cost,
          discount: quot.discount || 0,
          tax_amount: quot.tax_amount,
          grand_total: quot.grand_total,
          valid_until: quot.valid_until
        };
      }
    } catch (err) {
      // Ignore if billing repository fails
    }

    const effectiveTotal = invoice?.total_amount ?? quotation?.grand_total ?? order.total_amount;

    return {
      id: order.id,
      customer_id: order.customer_id,
      event_date: order.event_date,
      event_time: order.event_time,
      event_type: order.event_type,
      guest_count: order.guest_count,
      venue_address: order.venue_address,
      status: order.status,
      total_amount: effectiveTotal,
      advance_paid: invoice ? (invoice.paid_amount || 0) : order.advance_paid,
      invoice,
      quotation,
      items,
      status_history: statusHistory,
      created_at: order.created_at,
      updated_at: order.updated_at
    };
  }

  async getAllOrders(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const orders = await orderRepository.findAllOrders(filters, limit, offset);

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.getOrderItems(order.id);
        return {
          id: order.id,
          customer_id: order.customer_id,
          event_date: order.event_date,
          event_time: order.event_time,
          event_type: order.event_type,
          guest_count: order.guest_count,
          venue_address: order.venue_address,
          status: order.status,
          total_amount: order.total_amount,
          advance_paid: order.advance_paid || 0,
          item_count: items.length,
          created_at: order.created_at
        };
      })
    );

    return ordersWithItems;
  }

  async updateOrder(orderId, updateData) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    // Can only update draft orders
    if (order.status !== 'draft') {
      throw AppError.badRequest('Can only update draft orders');
    }

    let updatedOrder = await orderRepository.updateOrder(orderId, updateData);

    if (Array.isArray(updateData.order_items) && updateData.order_items.length > 0) {
      await orderRepository.deleteOrderItemsByOrderId(orderId);
      let totalAmount = 0;

      for (const item of updateData.order_items) {
        const menuItem = await menuRepository.findMenuItemById(item.menu_item_id);
        if (!menuItem) {
          throw AppError.notFound(`Menu item not found: ${item.menu_item_id}`);
        }
        if (Number(item.quantity) < Number(menuItem.min_quantity)) {
          throw AppError.badRequest(
            `Minimum quantity for ${menuItem.name} is ${menuItem.min_quantity}. You requested ${item.quantity}.`
          );
        }

        const unitPrice = await this._resolveItemCreationUnitPrice(menuItem, item.unit_price);
        const itemTotal = roundCurrency(Number(item.quantity) * unitPrice);
        totalAmount = roundCurrency(totalAmount + itemTotal);

        await orderRepository.createOrderItem(
          orderId,
          item.menu_item_id,
          item.quantity,
          unitPrice,
          item.customizations
        );
      }

      updatedOrder = await orderRepository.updateTotalAmount(orderId, totalAmount);
    }

    const items = await orderRepository.getOrderItems(orderId);

    return {
      id: updatedOrder.id,
      customer_id: updatedOrder.customer_id,
      event_date: updatedOrder.event_date,
      event_time: updatedOrder.event_time,
      event_type: updatedOrder.event_type,
      guest_count: updatedOrder.guest_count,
      venue_address: updatedOrder.venue_address,
      status: updatedOrder.status,
      total_amount: updatedOrder.total_amount,
      items,
      updated_at: updatedOrder.updated_at
    };
  }

  async updateOrderStatus(orderId, newStatus, userId = null) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    // Validate status transitions
    const validTransitions = {
      'draft': ['quoted', 'cancelled'],
      'quoted': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition from ${order.status} to ${newStatus}`,
        {
          current_status: order.status,
          requested_status: newStatus,
          allowed_transitions: validTransitions[order.status] || []
        }
      );
    }

    // ===== SIDE EFFECTS =====
    
    // Completion of order: consume reserved stock
    if (newStatus === 'completed' && order.status === 'preparing') {
      try {
        const reservations = await orderRepository.getStockReservations(orderId);
        for (const reservation of reservations) {
          try {
            await stockService.consumeReservedStock(
              reservation.ingredient_id,
              Number(reservation.reserved_quantity)
            );
          } catch (consumeError) {
            logger.error(`Failed to consume reserved stock for ingredient ${reservation.ingredient_id} on order ${orderId}:`, consumeError.message);
          }
        }
        await orderRepository.deleteStockReservations(orderId);
      } catch (err) {
        logger.error(`Stock consumption failed during completion of order ${orderId}:`, err.message);
      }
    }

    // Cancellation of confirmed/preparing orders: release reserved stock
    if (newStatus === 'cancelled' && ['confirmed', 'preparing'].includes(order.status)) {
      try {
        const reservations = await orderRepository.getStockReservations(orderId);
        for (const reservation of reservations) {
          try {
            await stockService.releaseReservedStock(
              reservation.ingredient_id,
              Number(reservation.reserved_quantity)
            );
          } catch (releaseError) {
            logger.error(
              `Failed to release stock for ingredient ${reservation.ingredient_id} on order ${orderId}:`,
              releaseError.message
            );
            // Continue releasing other ingredients; don't block cancellation
          }
        }
        await orderRepository.deleteStockReservations(orderId);
      } catch (err) {
        logger.error(`Stock release failed during cancellation of order ${orderId}:`, err.message);
        // Don't block cancellation (business decision per roadmap)
      }
    }

    const updatedOrder = await orderRepository.updateOrderStatus(orderId, newStatus);

    // Log status change
    try {
      let notes = `Status changed from ${order.status} to ${newStatus}`;
      if (newStatus === 'cancelled') notes += ' — stock released if applicable';
      if (newStatus === 'completed') notes += ' — order delivered';

      await orderRepository.logStatusChange(orderId, order.status, newStatus, userId, notes);
    } catch (err) {
      logger.error('Failed to log status change:', err.message);
    }

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      previous_status: order.status,
      updated_at: updatedOrder.updated_at
    };
  }

  async deleteOrder(orderId) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    // Can only delete draft orders
    if (order.status !== 'draft') {
      throw AppError.badRequest('Can only delete draft orders');
    }

    await orderRepository.deleteOrder(orderId);

    return { message: 'Order deleted successfully' };
  }

  async getCustomerOrders(customerId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const orders = await orderRepository.getOrderByCustomerId(customerId, limit, offset);
    const billingRepository = require('../billing/repository');

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.getOrderItems(order.id);
        let invoice = null;
        let quotation = null;
        try {
          const inv = await billingRepository.findInvoiceByOrderId(order.id);
          if (inv) {
            invoice = {
              id: inv.id,
              invoice_number: inv.invoice_number,
              total_amount: inv.total_amount,
              paid_amount: inv.paid_amount || 0,
              payment_status: inv.payment_status,
              due_date: inv.due_date
            };
          }
          const quot = await billingRepository.findQuotationByOrderId(order.id);
          if (quot) {
            quotation = {
              id: quot.id,
              quotation_number: quot.quotation_number,
              grand_total: quot.grand_total,
              valid_until: quot.valid_until
            };
          }
        } catch (err) {
          // Ignore non-critical billing lookup error
        }

        const effectiveTotal = invoice?.total_amount ?? quotation?.grand_total ?? order.total_amount;

        return {
          id: order.id,
          event_date: order.event_date,
          event_time: order.event_time,
          event_type: order.event_type,
          guest_count: order.guest_count,
          venue_address: order.venue_address,
          status: order.status,
          total_amount: effectiveTotal,
          advance_paid: invoice ? (invoice.paid_amount || 0) : (order.advance_paid || 0),
          invoice,
          quotation,
          items,
          item_count: items.length,
          created_at: order.created_at
        };
      })
    );

    return ordersWithItems;
  }
}

module.exports = new OrderService();
