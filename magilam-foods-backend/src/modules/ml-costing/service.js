const AppError = require('../../shared/errors/AppError');
const mlCostingRepository = require('./repository');

class MLCostingService {
  async createPrediction(data) {
    const prediction = await mlCostingRepository.createPrediction(data);

    if (!prediction) {
      throw AppError.internal('Failed to create prediction');
    }

    return {
      id: prediction.id,
      order_item_id: prediction.order_item_id,
      ingredient_cost: prediction.ingredient_cost,
      labor_cost: prediction.labor_cost,
      overhead_cost: prediction.overhead_cost,
      demand_factor: prediction.demand_factor,
      predicted_total: prediction.predicted_total,
      model_version: prediction.model_version,
      prediction_confidence: prediction.prediction_confidence,
      created_at: prediction.created_at
    };
  }

  async getPredictionById(predictionId) {
    const prediction = await mlCostingRepository.findPredictionById(predictionId);

    if (!prediction) {
      throw AppError.notFound('Prediction');
    }

    return {
      id: prediction.id,
      order_item_id: prediction.order_item_id,
      ingredient_cost: prediction.ingredient_cost,
      labor_cost: prediction.labor_cost,
      overhead_cost: prediction.overhead_cost,
      demand_factor: prediction.demand_factor,
      predicted_total: prediction.predicted_total,
      model_version: prediction.model_version,
      prediction_confidence: prediction.prediction_confidence,
      created_at: prediction.created_at
    };
  }

  async getAllPredictions(filters, page = 1, limit = 100) {
    const offset = (page - 1) * limit;
    const predictions = await mlCostingRepository.getAllPredictions(filters, limit, offset);

    return predictions.map(p => ({
      id: p.id,
      order_item_id: p.order_item_id,
      predicted_total: p.predicted_total,
      demand_factor: p.demand_factor,
      prediction_confidence: p.prediction_confidence,
      created_at: p.created_at
    }));
  }

  async getAnalytics(fromDate = null, toDate = null) {
    const summary = await mlCostingRepository.getCostSummary(fromDate, toDate);

    return {
      total_predictions: summary.total_predictions,
      cost_analysis: {
        average_total_cost: parseFloat(summary.avg_total_cost) || 0,
        min_cost: parseFloat(summary.min_cost) || 0,
        max_cost: parseFloat(summary.max_cost) || 0
      },
      cost_breakdown: {
        average_ingredient_cost: parseFloat(summary.avg_ingredient_cost) || 0,
        average_labor_cost: parseFloat(summary.avg_labor_cost) || 0,
        average_overhead_cost: parseFloat(summary.avg_overhead_cost) || 0
      },
      average_confidence: parseFloat(summary.avg_confidence) || 0,
      period: {
        from: fromDate || 'All time',
        to: toDate || 'Now'
      }
    };
  }

  async getTrends(days = 30) {
    const trends = await mlCostingRepository.getAverageCostByDay(days);

    return {
      period_days: days,
      total_records: trends.length,
      daily_trends: trends.map(t => ({
        date: t.date,
        avg_total_cost: parseFloat(t.avg_cost) || 0,
        avg_ingredient_cost: parseFloat(t.avg_ingredient_cost) || 0,
        avg_labor_cost: parseFloat(t.avg_labor_cost) || 0,
        order_count: parseInt(t.order_count) || 0
      }))
    };
  }

  async getOrderItemTrend(orderItemId) {
    const predictions = await mlCostingRepository.getOrderItemPredictions(orderItemId);

    if (predictions.length === 0) {
      throw AppError.notFound('Predictions for order item');
    }

    const sorted = predictions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return {
      order_item_id: orderItemId,
      total_predictions: predictions.length,
      latest_prediction: {
        predicted_total: sorted[sorted.length - 1].predicted_total,
        demand_factor: sorted[sorted.length - 1].demand_factor,
        confidence: sorted[sorted.length - 1].prediction_confidence,
        created_at: sorted[sorted.length - 1].created_at
      },
      prediction_history: sorted.map(p => ({
        predicted_total: p.predicted_total,
        demand_factor: p.demand_factor,
        confidence: p.prediction_confidence,
        created_at: p.created_at
      }))
    };
  }
}

module.exports = new MLCostingService();
