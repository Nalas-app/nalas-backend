const db = require('../../config/database');

class OrderRepository {
  async createOrder(customerId, data) {
    const query = `
      INSERT INTO orders 
      (customer_id, event_date, event_time, event_type, guest_count, venue_address, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft')
      RETURNING *
    `;
    const result = await db.query(query, [
      customerId,
      data.event_date,
      data.event_time,
      data.event_type,
      data.guest_count,
      data.venue_address
    ]);
    return result.rows[0];
  }

  async findOrderById(orderId) {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await db.query(query, [orderId]);
    return result.rows[0] || null;
  }

  async findAllOrders(filters = {}, limit = 10, offset = 0) {
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.from_date) {
      query += ` AND event_date >= $${params.length + 1}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      query += ` AND event_date <= $${params.length + 1}`;
      params.push(filters.to_date);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateOrder(orderId, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (data.event_date) {
      updates.push(`event_date = $${paramCount}`);
      params.push(data.event_date);
      paramCount++;
    }
    if (data.event_time) {
      updates.push(`event_time = $${paramCount}`);
      params.push(data.event_time);
      paramCount++;
    }
    if (data.guest_count) {
      updates.push(`guest_count = $${paramCount}`);
      params.push(data.guest_count);
      paramCount++;
    }
    if (data.venue_address) {
      updates.push(`venue_address = $${paramCount}`);
      params.push(data.venue_address);
      paramCount++;
    }

    if (updates.length === 0) return this.findOrderById(orderId);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(orderId);

    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  async updateOrderStatus(orderId, status) {
    const query = `
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [status, orderId]);
    return result.rows[0];
  }

  async deleteOrder(orderId) {
    const query = 'DELETE FROM orders WHERE id = $1 RETURNING *';
    const result = await db.query(query, [orderId]);
    return result.rows[0];
  }

  async createOrderItem(orderId, menuItemId, quantity, unitPrice, customizations = {}) {
    const totalPrice = quantity * unitPrice;
    const query = `
      INSERT INTO order_items 
      (order_id, menu_item_id, quantity, unit_price, total_price, customizations)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [
      orderId,
      menuItemId,
      quantity,
      unitPrice,
      totalPrice,
      JSON.stringify(customizations)
    ]);
    return result.rows[0];
  }

  async getOrderItems(orderId) {
    const query = `
      SELECT oi.*, mi.name, mi.description FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = $1
    `;
    const result = await db.query(query, [orderId]);
    return result.rows;
  }

  async updateTotalAmount(orderId, totalAmount) {
    const query = `
      UPDATE orders 
      SET total_amount = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [totalAmount, orderId]);
    return result.rows[0];
  }

  async getOrderByCustomerId(customerId, limit = 10, offset = 0) {
    const query = `
      SELECT * FROM orders 
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(query, [customerId, limit, offset]);
    return result.rows;
  }
}

module.exports = new OrderRepository();
