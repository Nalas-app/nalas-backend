const stockService = require('./service');

class StockController {
  // ===== INGREDIENTS =====
  async createIngredient(req, res, next) {
    try {
      const result = await stockService.createIngredient(req.body);

      res.status(201).json({
        success: true,
        message: 'Ingredient created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getIngredient(req, res, next) {
    try {
      const result = await stockService.getIngredientById(req.params.id);

      res.json({
        success: true,
        message: 'Ingredient retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listIngredients(req, res, next) {
    try {
      const { name, is_perishable, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (name) filters.name = name;
      if (is_perishable !== undefined) filters.is_perishable = is_perishable === 'true';

      const result = await stockService.getAllIngredients(filters, page, limit);

      res.json({
        success: true,
        message: 'Ingredients retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateIngredient(req, res, next) {
    try {
      const result = await stockService.updateIngredient(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Ingredient updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteIngredient(req, res, next) {
    try {
      const result = await stockService.deleteIngredient(req.params.id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== TRANSACTIONS =====
  async recordTransaction(req, res, next) {
    try {
      const result = await stockService.recordTransaction(req.body, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Transaction recorded successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req, res, next) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const result = await stockService.getIngredientTransactions(req.params.id, limit, page);

      res.json({
        success: true,
        message: 'Transactions retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== CURRENT STOCK =====
  async getStockLevel(req, res, next) {
    try {
      const result = await stockService.getCurrentStockLevel(req.params.id);

      res.json({
        success: true,
        message: 'Stock level retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listStockLevels(req, res, next) {
    try {
      const { page = 1, limit = 100 } = req.query;
      const result = await stockService.getAllStockLevels(page, limit);

      res.json({
        success: true,
        message: 'Stock levels retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProcurementAlerts(req, res, next) {
    try {
      const result = await stockService.getProcurementAlerts();

      res.json({
        success: true,
        message: 'Procurement alerts retrieved successfully',
        data: result,
        count: result.length
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== RESERVATION =====
  async reserveStock(req, res, next) {
    try {
      const result = await stockService.reserveStock(req.params.id, req.body.quantity);

      res.json({
        success: true,
        message: 'Stock reserved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async releaseStock(req, res, next) {
    try {
      const result = await stockService.releaseReservedStock(req.params.id, req.body.quantity);

      res.json({
        success: true,
        message: 'Reserved stock released successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StockController();
