const express = require('express');
const mlCostingController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  createPredictionSchema,
  getAnalyticsSchema,
  getTrendsSchema
} = require('./validators');

const router = express.Router();

// Create prediction (admin only)
router.post(
  '/predictions',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createPredictionSchema),
  mlCostingController.createPrediction
);

// Get prediction by ID
router.get(
  '/predictions/:id',
  authenticate,
  mlCostingController.getPrediction
);

// List all predictions (admin only)
router.get(
  '/predictions',
  authenticate,
  requireRole('admin', 'super_admin'),
  mlCostingController.listPredictions
);

// Get analytics
router.get(
  '/analytics',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(getAnalyticsSchema, 'query'),
  mlCostingController.getAnalytics
);

// Get trends
router.get(
  '/trends',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(getTrendsSchema, 'query'),
  mlCostingController.getTrends
);

// Get order item trend
router.get(
  '/items/:id/trend',
  authenticate,
  requireRole('admin', 'super_admin'),
  mlCostingController.getOrderItemTrend
);

module.exports = router;
