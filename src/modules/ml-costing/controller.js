const mlCostingService = require('./service');

class MLCostingController {
  async createPrediction(req, res, next) {
    try {
      const result = await mlCostingService.createPrediction(req.body);

      res.status(201).json({
        success: true,
        message: 'Prediction created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getPrediction(req, res, next) {
    try {
      const result = await mlCostingService.getPredictionById(req.params.id);

      res.json({
        success: true,
        message: 'Prediction retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listPredictions(req, res, next) {
    try {
      const { from_date, to_date, page = 1, limit = 100 } = req.query;

      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;

      const result = await mlCostingService.getAllPredictions(filters, page, limit);

      res.json({
        success: true,
        message: 'Predictions retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const { from_date, to_date } = req.query;

      const result = await mlCostingService.getAnalytics(from_date, to_date);

      res.json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrends(req, res, next) {
    try {
      const { days = 30 } = req.query;

      const result = await mlCostingService.getTrends(parseInt(days));

      res.json({
        success: true,
        message: 'Trends retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderItemTrend(req, res, next) {
    try {
      const result = await mlCostingService.getOrderItemTrend(req.params.id);

      res.json({
        success: true,
        message: 'Order item trend retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MLCostingController();
