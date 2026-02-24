const db = require('../../config/database');

class MLCostingRepository {
  async createPrediction(data) {
    const query = `
      INSERT INTO ml_cost_predictions 
      (order_item_id, ingredient_cost, labor_cost, overhead_cost, demand_factor, predicted_total, model_version, prediction_confidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.order_item_id,
      data.ingredient_cost,
      data.labor_cost,
      data.overhead_cost,
      data.demand_factor || 1.0,
      data.predicted_total,
      data.model_version || '1.0',
      data.prediction_confidence || null
    ]);
    return result.rows[0];
  }

  async findPredictionById(id) {
    const query = 'SELECT * FROM ml_cost_predictions WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getOrderItemPredictions(orderItemId) {
    const query = `
      SELECT * FROM ml_cost_predictions 
      WHERE order_item_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [orderItemId]);
    return result.rows;
  }

  async getAllPredictions(filters = {}, limit = 100, offset = 0) {
    let query = 'SELECT * FROM ml_cost_predictions WHERE 1=1';
    const params = [];

    if (filters.from_date) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(filters.to_date);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async getAverageCostByDay(days = 30) {
    const query = `
      SELECT 
        DATE(created_at) as date,
        AVG(predicted_total) as avg_cost,
        AVG(ingredient_cost) as avg_ingredient_cost,
        AVG(labor_cost) as avg_labor_cost,
        COUNT(*) as order_count
      FROM ml_cost_predictions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const result = await db.query(query, []);
    return result.rows;
  }

  async getCostSummary(fromDate = null, toDate = null) {
    let query = `
      SELECT 
        COUNT(*) as total_predictions,
        AVG(predicted_total) as avg_total_cost,
        MIN(predicted_total) as min_cost,
        MAX(predicted_total) as max_cost,
        AVG(ingredient_cost) as avg_ingredient_cost,
        AVG(labor_cost) as avg_labor_cost,
        AVG(overhead_cost) as avg_overhead_cost,
        AVG(prediction_confidence) as avg_confidence
      FROM ml_cost_predictions
    `;

    if (fromDate && toDate) {
      query += ` WHERE created_at BETWEEN $1 AND $2`;
    }

    const result = await db.query(query, fromDate && toDate ? [fromDate, toDate] : []);
    return result.rows[0];
  }
}

module.exports = new MLCostingRepository();
