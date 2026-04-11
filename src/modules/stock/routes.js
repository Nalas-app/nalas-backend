const express = require('express');
const stockController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  createIngredientSchema,
  updateIngredientSchema,
  createTransactionSchema,
  reserveStockSchema,
  querySchema,
  procurementAlertsQuerySchema
} = require('./validators');

const router = express.Router();

// ===== INGREDIENTS =====
// List all ingredients
router.get(
  '/ingredients',
  authenticate,
  validate(querySchema, 'query'),
  stockController.listIngredients
);

// Create new ingredient (admin only)
router.post(
  '/ingredients',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createIngredientSchema),
  stockController.createIngredient
);

// Get ingredient by ID
router.get(
  '/ingredients/:id',
  authenticate,
  stockController.getIngredient
);

// Update ingredient (admin only)
router.put(
  '/ingredients/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(updateIngredientSchema),
  stockController.updateIngredient
);

// Delete ingredient (admin only)
router.delete(
  '/ingredients/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  stockController.deleteIngredient
);

// ===== TRANSACTIONS =====
// Record new transaction (admin only)
router.post(
  '/transactions',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createTransactionSchema),
  stockController.recordTransaction
);

// Get transactions for ingredient
router.get(
  '/ingredients/:id/transactions',
  authenticate,
  stockController.getTransactions
);

// ===== CURRENT STOCK =====
// Get stock level for ingredient
router.get(
  '/current/:id',
  authenticate,
  stockController.getStockLevel
);

// Get all stock levels
router.get(
  '/current',
  authenticate,
  stockController.listStockLevels
);

// Get procurement alerts (low stock items)
router.get(
  '/alerts/procurement',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(procurementAlertsQuerySchema, 'query'),
  stockController.getProcurementAlerts
);

// ===== RESERVATION =====
// Reserve stock for order
router.post(
  '/reserve/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(reserveStockSchema),
  stockController.reserveStock
);

// Release reserved stock
router.post(
  '/release/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  stockController.releaseStock
);

module.exports = router;
