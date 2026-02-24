const AppError = require('../../shared/errors/AppError');
const orderRepository = require('./repository');

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

  async getOrderById(orderId, userId = null) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw AppError.notFound('Order');
    }

    const items = await orderRepository.getOrderItems(orderId);

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

  async updateOrderStatus(orderId, newStatus) {
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

    if (!validTransitions[order.status].includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition from ${order.status} to ${newStatus}`,
        { current_status: order.status, requested_status: newStatus }
      );
    }

    const updatedOrder = await orderRepository.updateOrderStatus(orderId, newStatus);

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
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
