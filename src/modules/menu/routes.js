const express = require('express');
const menuController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createRecipeSchema,
  querySchema
} = require('./validators');

const router = express.Router();

// ===== CATEGORIES =====
// List all categories
router.get(
  '/categories',
  authenticate,
  menuController.listCategories
);

// Create category (admin only)
router.post(
  '/categories',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createCategorySchema),
  menuController.createCategory
);

// Get category by ID
router.get(
  '/categories/:id',
  authenticate,
  menuController.getCategory
);

// Update category (admin only)
router.put(
  '/categories/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(updateCategorySchema),
  menuController.updateCategory
);

// Delete category (admin only)
router.delete(
  '/categories/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  menuController.deleteCategory
);

// ===== MENU ITEMS =====
// List all menu items
router.get(
  '/items',
  authenticate,
  validate(querySchema, 'query'),
  menuController.listMenuItems
);

// Create menu item (admin only)
router.post(
  '/items',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createMenuItemSchema),
  menuController.createMenuItem
);

// Get menu item by ID
router.get(
  '/items/:id',
  authenticate,
  menuController.getMenuItem
);

// Update menu item (admin only)
router.put(
  '/items/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(updateMenuItemSchema),
  menuController.updateMenuItem
);

// Delete menu item (admin only)
router.delete(
  '/items/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  menuController.deleteMenuItem
);

// ===== RECIPES =====
// Get recipe for menu item
router.get(
  '/items/:id/recipe',
  authenticate,
  menuController.getRecipe
);

// Add ingredient to recipe (admin only)
router.post(
  '/items/:id/recipe',
  authenticate,
  requireRole('admin', 'super_admin'),
  validate(createRecipeSchema),
  menuController.addRecipeIngredient
);

// Remove ingredient from recipe (admin only)
router.delete(
  '/items/:id/recipe',
  authenticate,
  requireRole('admin', 'super_admin'),
  menuController.removeRecipeIngredient
);

module.exports = router;
