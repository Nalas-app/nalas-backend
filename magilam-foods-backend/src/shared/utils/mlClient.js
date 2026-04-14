const axios = require('axios');
const logger = require('./logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

class MLClient {
  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Predict cost for a menu item
   * @param {Object} data { menuItemId, quantity, eventDate, guestCount }
   * @returns {Promise<Object>} Cost breakdown and metadata
   */
  async predictCost(data) {
    try {
      const response = await this.client.post('/ml/predict-cost', {
        menuItemId: data.menuItemId,
        quantity: data.quantity,
        eventDate: data.eventDate || new Date().toISOString(),
        guestCount: data.guestCount || 100
      });

      return response.data;
    } catch (error) {
      logger.error('ML Prediction Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async getHealth() {
    try {
      const response = await this.client.get('/ml/health');
      return response.data;
    } catch (error) {
      logger.error('ML Health Check Failed:', error.message);
      return { status: 'down' };
    }
  }
}

module.exports = new MLClient();
