const db = require('../../config/database');

class StockRepository {
  // ===== INGREDIENTS =====
  async createIngredient(data) {
    const query = `
      INSERT INTO ingredients 
      (name, unit, current_price_per_unit, reorder_level, is_perishable, shelf_life_days)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.name,
      data.unit,
      data.current_price_per_unit,
      data.reorder_level || 0,
      data.is_perishable || false,
      data.shelf_life_days || null
    ]);
    return result.rows[0];
  }

  async findIngredientById(id) {
    const query = 'SELECT * FROM ingredients WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAllIngredients(filters = {}, limit = 10, offset = 0) {
    let query = 'SELECT * FROM ingredients WHERE 1=1';
    const params = [];

    if (filters.name) {
      query += ` AND name ILIKE $${params.length + 1}`;
      params.push(`%${filters.name}%`);
    }

    if (filters.is_perishable !== undefined) {
      query += ` AND is_perishable = $${params.length + 1}`;
      params.push(filters.is_perishable);
    }

    const allowedSortFields = ['created_at', 'name', 'current_price_per_unit', 'reorder_level', 'updated_at'];
    const sortBy = allowedSortFields.includes(filters.sortBy) ? filters.sortBy : 'created_at';
    const sortBy = filters.sortBy || 'created_at';
    query += ` ORDER BY ${sortBy} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateIngredient(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount}`);
      params.push(data.name);
      paramCount++;
    }
    if (data.unit) {
      updates.push(`unit = $${paramCount}`);
      params.push(data.unit);
      paramCount++;
    }
    if (data.current_price_per_unit !== undefined) {
      updates.push(`current_price_per_unit = $${paramCount}`);
      params.push(data.current_price_per_unit);
      paramCount++;
    }
    if (data.reorder_level !== undefined) {
      updates.push(`reorder_level = $${paramCount}`);
      params.push(data.reorder_level);
      paramCount++;
    }
    if (data.is_perishable !== undefined) {
      updates.push(`is_perishable = $${paramCount}`);
      params.push(data.is_perishable);
      paramCount++;
    }
    if (data.shelf_life_days !== undefined) {
      updates.push(`shelf_life_days = $${paramCount}`);
      params.push(data.shelf_life_days);
      paramCount++;
    }

    if (updates.length === 0) return this.findIngredientById(id);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `UPDATE ingredients SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  async deleteIngredient(id) {
    const query = 'DELETE FROM ingredients WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  // ===== STOCK TRANSACTIONS =====
  async createTransaction(data) {
    const query = `
      INSERT INTO stock_transactions 
      (ingredient_id, transaction_type, quantity, unit_price, reference_id, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.ingredient_id,
      data.transaction_type,
      data.quantity,
      data.unit_price || null,
      data.reference_id || null,
      data.notes || null,
      data.created_by || null
    ]);
    return result.rows[0];
  }

  async getTransactions(ingredientId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM stock_transactions 
      WHERE ingredient_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(query, [ingredientId, limit, offset]);
    return result.rows;
  }

  // ===== CURRENT STOCK =====
  async getCurrentStock(ingredientId) {
    const query = 'SELECT * FROM current_stock WHERE ingredient_id = $1';
    const result = await db.query(query, [ingredientId]);
    return result.rows[0] || null;
  }

  async initializeStock(ingredientId, quantity = 0) {
    const query = `
      INSERT INTO current_stock 
      (ingredient_id, available_quantity, reserved_quantity)
      VALUES ($1, $2, 0)
      ON CONFLICT (ingredient_id) DO NOTHING
      RETURNING *
    `;
    const result = await db.query(query, [ingredientId, quantity]);
    return result.rows[0];
  }

  async updateCurrentStock(ingredientId, availableQty, reservedQty = null) {
    let query = `
      UPDATE current_stock 
      SET available_quantity = $1, last_updated = CURRENT_TIMESTAMP
    `;
    const params = [availableQty];

    if (reservedQty !== null) {
      query += `, reserved_quantity = $2`;
      params.push(reservedQty);
      query += ` WHERE ingredient_id = $3 RETURNING *`;
      params.push(ingredientId);
    } else {
      query += ` WHERE ingredient_id = $2 RETURNING *`;
      params.push(ingredientId);
    }

    const params = [availableQty, ingredientId];
    let paramCount = 2;

    if (reservedQty !== null) {
      query += `, reserved_quantity = $${paramCount + 1}`;
      params.splice(paramCount, 0, reservedQty);
      paramCount++;
    }

    query += ` WHERE ingredient_id = $${paramCount + 1} RETURNING *`;
    params.push(ingredientId);

    const result = await db.query(query, params);
    return result.rows[0];
  }

  async reserveStock(ingredientId, quantity) {
    const query = `
      UPDATE current_stock
      SET
        available_quantity = available_quantity - $2,
        reserved_quantity = reserved_quantity + $2,
        last_updated = CURRENT_TIMESTAMP
      WHERE ingredient_id = $1
        AND available_quantity >= $2
      RETURNING *
    `;

    const result = await db.query(query, [ingredientId, quantity]);
    if (result.rows[0]) {
      return result.rows[0];
    }

    const stock = await this.getCurrentStock(ingredientId);
    if (!stock) {
      throw new Error('No stock found for ingredient');
    }

    throw new Error('Insufficient stock available');
  }

  async consumeStock(ingredientId, quantity) {
    const query = `
      UPDATE current_stock
      SET
        reserved_quantity = reserved_quantity - $2,
        last_updated = CURRENT_TIMESTAMP
      WHERE ingredient_id = $1
        AND reserved_quantity >= $2
      RETURNING *
    `;

    const result = await db.query(query, [ingredientId, quantity]);
    if (result.rows[0]) {
      return result.rows[0];
    }

    const stock = await this.getCurrentStock(ingredientId);
    if (!stock) {
      throw new Error('No stock found for ingredient');
    }

    throw new Error('Insufficient reserved stock');
  }

  async releaseReservedStock(ingredientId, quantity) {
    const query = `
      UPDATE current_stock
      SET
        reserved_quantity = reserved_quantity - $2,
        available_quantity = available_quantity + $2,
        last_updated = CURRENT_TIMESTAMP
      WHERE ingredient_id = $1
        AND reserved_quantity >= $2
      RETURNING *
    `;

    const result = await db.query(query, [ingredientId, quantity]);
    if (result.rows[0]) {
      return result.rows[0];
    }

    const stock = await this.getCurrentStock(ingredientId);
    if (!stock) {
      throw new Error('No stock found for ingredient');
    }

    throw new Error('Insufficient reserved stock to release');
    const currentStock = await this.getCurrentStock(ingredientId);

    if (!currentStock) {
      throw new Error('No stock found for ingredient');
    }

    if (currentStock.available_quantity < quantity) {
      throw new Error('Insufficient stock available');
    }

    const newReserved = currentStock.reserved_quantity + quantity;
    const newAvailable = currentStock.available_quantity - quantity;

    return this.updateCurrentStock(ingredientId, newAvailable, newReserved);
  }

  async consumeStock(ingredientId, quantity) {
    const currentStock = await this.getCurrentStock(ingredientId);

    if (!currentStock) {
      throw new Error('No stock found for ingredient');
    }

    const newReserved = Math.max(0, currentStock.reserved_quantity - quantity);
    return this.updateCurrentStock(ingredientId, currentStock.available_quantity, newReserved);
  }

  async getAllCurrentStock(limit = 100, offset = 0) {
    const query = `
      SELECT cs.*, i.name, i.unit, i.current_price_per_unit
      FROM current_stock cs
      LEFT JOIN ingredients i ON cs.ingredient_id = i.id
      ORDER BY i.name
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }

  async getProcurementAlerts() {
    const query = `
      SELECT i.*, cs.available_quantity
      FROM ingredients i
      LEFT JOIN current_stock cs ON i.id = cs.ingredient_id
      WHERE COALESCE(cs.available_quantity, 0) <= i.reorder_level
      WHERE cs.available_quantity <= i.reorder_level
      ORDER BY i.name
    `;
    const result = await db.query(query, []);
    return result.rows;
  }
}

module.exports = new StockRepository();
