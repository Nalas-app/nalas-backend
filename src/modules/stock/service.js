const AppError = require('../../shared/errors/AppError');
const stockRepository = require('./repository');

class StockService {
  // ===== INGREDIENT MANAGEMENT =====
  async createIngredient(data) {
    const ingredient = await stockRepository.createIngredient(data);

    if (!ingredient) {
      throw AppError.internal('Failed to create ingredient');
    }

    // Initialize stock for this ingredient
    await stockRepository.initializeStock(ingredient.id, 0);

    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      current_price_per_unit: ingredient.current_price_per_unit,
      reorder_level: ingredient.reorder_level,
      is_perishable: ingredient.is_perishable,
      shelf_life_days: ingredient.shelf_life_days,
      created_at: ingredient.created_at
    };
  }

  async getIngredientById(ingredientId) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const currentStock = await stockRepository.getCurrentStock(ingredientId);

    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      current_price_per_unit: ingredient.current_price_per_unit,
      reorder_level: ingredient.reorder_level,
      is_perishable: ingredient.is_perishable,
      shelf_life_days: ingredient.shelf_life_days,
      current_stock: currentStock?.available_quantity || 0,
      reserved_stock: currentStock?.reserved_quantity || 0,
      created_at: ingredient.created_at
    };
  }

  async getAllIngredients(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const ingredients = await stockRepository.findAllIngredients(filters, limit, offset);

    const result = await Promise.all(
      ingredients.map(async (ing) => {
        const currentStock = await stockRepository.getCurrentStock(ing.id);
        return {
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          current_price_per_unit: ing.current_price_per_unit,
          reorder_level: ing.reorder_level,
          current_stock: currentStock?.available_quantity || 0,
          reserved_stock: currentStock?.reserved_quantity || 0,
          is_perishable: ing.is_perishable
        };
      })
    );

    return result;
  }

  async updateIngredient(ingredientId, data) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const updated = await stockRepository.updateIngredient(ingredientId, data);

    const currentStock = await stockRepository.getCurrentStock(ingredientId);

    return {
      id: updated.id,
      name: updated.name,
      unit: updated.unit,
      current_price_per_unit: updated.current_price_per_unit,
      reorder_level: updated.reorder_level,
      is_perishable: updated.is_perishable,
      shelf_life_days: updated.shelf_life_days,
      current_stock: currentStock?.available_quantity || 0,
      updated_at: updated.updated_at
    };
  }

  async deleteIngredient(ingredientId) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    await stockRepository.deleteIngredient(ingredientId);

    return { message: 'Ingredient deleted successfully' };
  }

  // ===== STOCK TRANSACTIONS =====
  async recordTransaction(data, userId) {
    const ingredient = await stockRepository.findIngredientById(data.ingredient_id);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const currentStock = await stockRepository.getCurrentStock(data.ingredient_id);
    if (!currentStock) {
      throw AppError.internal('Stock not initialized for ingredient');
    }

    let newAvailableQty = Number(currentStock.available_quantity);
    const quantity = Number(data.quantity);

    // Update stock based on transaction type
    if (data.transaction_type === 'purchase') {
      newAvailableQty += quantity;
    } else if (data.transaction_type === 'consumption' || data.transaction_type === 'wastage') {
      if (Number(currentStock.available_quantity) < quantity) {
        throw AppError.badRequest('Insufficient stock for this transaction');
      }
      newAvailableQty -= quantity;
    } else if (data.transaction_type === 'adjustment') {
      newAvailableQty = quantity; // Set to exact quantity
    let newAvailableQty = currentStock.available_quantity;

    // Update stock based on transaction type
    if (data.transaction_type === 'purchase') {
      newAvailableQty += data.quantity;
    } else if (data.transaction_type === 'consumption' || data.transaction_type === 'wastage') {
      if (currentStock.available_quantity < data.quantity) {
        throw AppError.badRequest('Insufficient stock for this transaction');
      }
      newAvailableQty -= data.quantity;
    } else if (data.transaction_type === 'adjustment') {
      newAvailableQty = data.quantity; // Set to exact quantity
    }

    // Create transaction record
    const transaction = await stockRepository.createTransaction({
      ...data,
      created_by: userId
    });

    // Update current stock
    await stockRepository.updateCurrentStock(data.ingredient_id, newAvailableQty);

    return {
      id: transaction.id,
      ingredient_id: transaction.ingredient_id,
      ingredient_name: ingredient.name,
      type: transaction.transaction_type,
      quantity: transaction.quantity,
      unit_price: transaction.unit_price,
      notes: transaction.notes,
      created_at: transaction.created_at
    };
  }

  async getIngredientTransactions(ingredientId, limit = 50, page = 1) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const offset = (page - 1) * limit;
    const transactions = await stockRepository.getTransactions(ingredientId, limit, offset);

    return transactions.map(t => ({
      id: t.id,
      type: t.transaction_type,
      quantity: t.quantity,
      unit_price: t.unit_price,
      notes: t.notes,
      created_at: t.created_at
    }));
  }

  // ===== CURRENT STOCK =====
  async getCurrentStockLevel(ingredientId) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const currentStock = await stockRepository.getCurrentStock(ingredientId);

    return {
      ingredient_id: ingredientId,
      ingredient_name: ingredient.name,
      unit: ingredient.unit,
      available_quantity: currentStock?.available_quantity || 0,
      reserved_quantity: currentStock?.reserved_quantity || 0,
      usable_quantity: (currentStock?.available_quantity || 0) - (currentStock?.reserved_quantity || 0),
      last_updated: currentStock?.last_updated
    };
  }

  async getAllStockLevels(page = 1, limit = 100) {
    const offset = (page - 1) * limit;
    const stocks = await stockRepository.getAllCurrentStock(limit, offset);

    return stocks.map(s => ({
      ingredient_id: s.ingredient_id,
      ingredient_name: s.name,
      unit: s.unit,
      price_per_unit: s.current_price_per_unit,
      available_quantity: s.available_quantity,
      reserved_quantity: s.reserved_quantity,
      usable_quantity: s.available_quantity - s.reserved_quantity
    }));
  }

  async getProcurementAlerts(filters = {}) {
    const alerts = await stockRepository.getProcurementAlerts();

    const normalizedAlerts = alerts.map(a => {
      const currentLevel = Number(a.available_quantity || 0);
      const reorderLevel = Number(a.reorder_level || 0);
      const status = currentLevel <= reorderLevel * 0.5 ? 'CRITICAL' : 'LOW';

      return {
        ingredient_id: a.id,
        ingredient_name: a.name,
        current_level: currentLevel,
        reorder_level: reorderLevel,
        unit: a.unit,
        status
      };
    });

    if (filters.severity) {
      return normalizedAlerts.filter(alert => alert.status === filters.severity);
    }

    return normalizedAlerts;
  }

  getProcurementAlertsSummary(alerts) {
    const critical = alerts.filter(alert => alert.status === 'CRITICAL').length;
    const low = alerts.filter(alert => alert.status === 'LOW').length;

    return {
      total: alerts.length,
      critical,
      low
    };
  async getProcurementAlerts() {
    const alerts = await stockRepository.getProcurementAlerts();

    return alerts.map(a => ({
      ingredient_id: a.id,
      ingredient_name: a.name,
      current_level: a.available_quantity || 0,
      reorder_level: a.reorder_level,
      unit: a.unit,
      status: (a.available_quantity || 0) <= (a.reorder_level || 0) ? 'LOW' : 'CRITICAL'
    }));
  }

  // ===== STOCK RESERVATION (for orders) =====
  async reserveStock(ingredientId, quantity) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    try {
      const updated = await stockRepository.reserveStock(ingredientId, quantity);

      return {
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        reserved_quantity: updated.reserved_quantity,
        available_quantity: updated.available_quantity
      };
    } catch (error) {
      if (error.message.includes('Insufficient')) {
        throw AppError.badRequest('Insufficient stock available for reservation');
      }
      throw error;
    }
  }

  async releaseReservedStock(ingredientId, quantity) {
    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    try {
      const updated = await stockRepository.releaseReservedStock(ingredientId, quantity);
      const updated = await stockRepository.consumeStock(ingredientId, quantity);

      return {
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        reserved_quantity: updated.reserved_quantity,
        available_quantity: updated.available_quantity
      };
    } catch (error) {
      if (error.message.includes('Insufficient')) {
        throw AppError.badRequest('Insufficient reserved stock to release');
      }
      throw AppError.internal(error.message);
    }
  }
}

module.exports = new StockService();
