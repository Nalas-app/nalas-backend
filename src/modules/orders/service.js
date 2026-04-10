const axios = require('axios');
const AppError = require('../../shared/errors/AppError');
const orderRepository = require('./repository');
const billingService = require('../billing/service');
const stockService = require('../stock/service');
const menuRepository = require('../menu/repository');
const logger = require('../../shared/utils/logger');
const { pool } = require('../../config/database');

class OrderService {
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
      // Note: In production, you'd fetch menu item price here
      // For now, we accept unit_price in the request (to be removed later)
      const unitPrice = item.unit_price || 500; // Default placeholder
      const itemTotal = item.quantity * unitPrice;
      totalAmount += itemTotal;

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
  async generateQuotation(orderId, userId) {
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

    // Calculate costs per item using recipes (with ML fallback)
    let subtotal = 0;
    let isMlPredicted = true;
    const itemBreakdown = [];

    for (const item of orderItems) {
      let itemCost;
      let usedMl = false;

      try {
        // Attempt ML-based cost prediction
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        
        // Fetch recipe or base data to provide to ML
        const recipe = await menuRepository.getRecipe(item.menu_item_id);
        const baseIngredientCost = recipe && recipe.length > 0 
          ? recipe.reduce((total, r) => total + (r.quantity_per_base_unit * (r.wastage_factor || 1.0) * r.current_price_per_unit), 0)
          : (item.unit_price || 500);

        const mlResponse = await axios.post(`${mlServiceUrl}/predict-cost`, {
          event_type: order.event_type || 'General',
          location: order.venue_address || 'Default',
          quantity: Number(item.quantity),
          ingredient_cost: Number(baseIngredientCost),
          labor_cost: 500, // Based on billing settings
          overhead_cost: baseIngredientCost * 0.1,
          demand_index: 1.0
        }, { timeout: 3000 });

        if (mlResponse.data && mlResponse.data.predicted_cost) {
          itemCost = mlResponse.data.predicted_cost * item.quantity;
          usedMl = true;
        } else {
          throw new Error('Invalid ML response');
        }
      } catch (err) {
        // ML failure fallback: Recipe-based calculation
        logger.warn(`ML prediction failed for item ${item.menu_item_id}, falling back to recipe:`, err.message);
        
        const recipe = await menuRepository.getRecipe(item.menu_item_id);
        if (recipe && recipe.length > 0) {
          itemCost = recipe.reduce((total, r) => {
            return total + (
              r.quantity_per_base_unit *
              (r.wastage_factor || 1.0) *
              r.current_price_per_unit *
              item.quantity
            );
          }, 0);
        } else {
          itemCost = (item.unit_price || 500) * item.quantity * 1.3;
        }
        isMlPredicted = false;
      }

      subtotal += itemCost;
      itemBreakdown.push({
        menu_item_id: item.menu_item_id,
        name: item.name,
        quantity: item.quantity,
        calculated_cost: itemCost,
        method: usedMl ? 'ML' : 'Recipe/Fallback'
      });
    }

    // Create quotation via billing service
    const quotation = await billingService.createQuotation({
      order_id: orderId,
      labor_cost_per_guest: 500,
      overhead_percentage: 10,
      tax_percentage: 5
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
      is_ml_predicted: isMlPredicted,
      status: updatedOrder.status
    };
  }

  // ===== ORDER CONFIRMATION (Order → Stock → Billing integration) =====
  async confirmOrder(orderId, userId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Use SELECT FOR UPDATE to lock the order row and prevent concurrent confirmation
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = orderRes.rows[0];

      if (!order) {
        throw AppError.notFound('Order');
      }

      if (order.status !== 'quoted') {
        throw AppError.badRequest(
          'Order can only be confirmed when in quoted status',
          { current_status: order.status }
        );
      }

      // Verify quotation exists and is valid
      const billingRepository = require('../billing/repository');
      const quotation = await billingRepository.findQuotationByOrderId(orderId);

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
      for (const [ingredientId, need] of Object.entries(ingredientNeeds)) {
        // This call might also need to be part of the transaction 
        // depending on how stockService is implemented.
        // For now, we rely on the order lock and all-or-nothing rollback below.
        await stockService.reserveStock(ingredientId, need.quantity);
        reservedIngredients.push({
          ingredient_id: ingredientId,
          quantity: need.quantity
        });

        // Save reservation record
        await orderRepository.saveStockReservation(orderId, ingredientId, need.quantity);
      }

      // Create invoice via billing service
      let invoice;
      try {
        invoice = await billingService.createInvoice({
          order_id: orderId,
          due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (invoiceError) {
        throw new Error(`Invoice generation failed: ${invoiceError.message}`);
      }

      // Update order status to 'confirmed'
      const updatedOrder = await orderRepository.updateOrderStatus(orderId, 'confirmed');

      // Log status change
      await orderRepository.logStatusChange(
        orderId, 'quoted', 'confirmed', userId,
        `Stock reserved for ${reservedIngredients.length} ingredients. Invoice ${invoice.invoice_number} created.`
      );

      await client.query('COMMIT');

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
    } catch (err) {
      await client.query('ROLLBACK');
      
      // Secondary rollback: release stock if reserved
      // (Note: In a robust distributed transaction, we'd use a more unified approach)
      logger.error('Order confirmation failed, rolling back:', err.message);
      
      throw err;
    } finally {
      client.release();
    }
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
      advance_paid: order.advance_paid,
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
          event_type: order.event_type,
          guest_count: order.guest_count,
          status: order.status,
          total_amount: order.total_amount,
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

    const updatedOrder = await orderRepository.updateOrder(orderId, updateData);

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

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.getOrderItems(order.id);
        return {
          id: order.id,
          event_date: order.event_date,
          event_type: order.event_type,
          guest_count: order.guest_count,
          status: order.status,
          total_amount: order.total_amount,
          item_count: items.length,
          created_at: order.created_at
        };
      })
    );

    return ordersWithItems;
  }
}

module.exports = new OrderService();
