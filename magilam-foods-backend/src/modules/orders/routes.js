const express = require('express');
const orderController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  createOrderSchema,
  updateOrderSchema,
  updateStatusSchema,
  querySchema
} = require('./validators');

const router = express.Router();

// Get all orders (admin only)
router.get(
  '/',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(querySchema, 'query'),
  orderController.list
);

// Get customer's own orders
router.get(
  '/my-orders',
  authenticate,
  validate(querySchema, 'query'),
  orderController.getCustomerOrders
);

// Create new order
router.post(
  '/',
  authenticate,
  validate(createOrderSchema),
  orderController.create
);

// Get order by ID
router.get(
  '/:id',
  authenticate,
  orderController.getById
);

// Update order (only draft orders)
router.put(
  '/:id',
  authenticate,
  validate(updateOrderSchema),
  orderController.update
);

// Update order status
router.put(
  '/:id/status',
  authenticate,
  validate(updateStatusSchema),
  orderController.updateStatus
);

// Delete order (only draft orders)
router.delete(
  '/:id',
  authenticate,
  orderController.delete
);

module.exports = router;
