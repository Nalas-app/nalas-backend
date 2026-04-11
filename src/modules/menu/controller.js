const menuService = require('./service');

class MenuController {
  // ===== CATEGORIES =====
  async createCategory(req, res, next) {
    try {
      const result = await menuService.createCategory(req.body);

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategory(req, res, next) {
    try {
      const result = await menuService.getCategoryById(req.params.id);

      res.json({
        success: true,
        message: 'Category retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req, res, next) {
    try {
      const { is_active = true } = req.query;
      const result = await menuService.getAllCategories(is_active === 'true' || is_active === true);

      res.json({
        success: true,
        message: 'Categories retrieved successfully',
        data: result,
        count: result.length
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const result = await menuService.updateCategory(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await menuService.deleteCategory(req.params.id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== MENU ITEMS =====
  async createMenuItem(req, res, next) {
    try {
      const result = await menuService.createMenuItem(req.body);

      res.status(201).json({
        success: true,
        message: 'Menu item created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getMenuItem(req, res, next) {
    try {
      const result = await menuService.getMenuItemById(req.params.id);

      res.json({
        success: true,
        message: 'Menu item retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listMenuItems(req, res, next) {
    try {
      const { name, category_id, is_active, is_customizable, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (name) filters.name = name;
      if (category_id) filters.category_id = category_id;
      if (is_active !== undefined) filters.is_active = is_active === 'true';
      if (is_customizable !== undefined) filters.is_customizable = is_customizable === 'true';

      const result = await menuService.getAllMenuItems(filters, page, limit);

      res.json({
        success: true,
        message: 'Menu items retrieved successfully',
        data: result,
        pagination: { page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMenuItem(req, res, next) {
    try {
      const result = await menuService.updateMenuItem(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Menu item updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMenuItem(req, res, next) {
    try {
      const result = await menuService.deleteMenuItem(req.params.id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== RECIPES =====
  async addRecipeIngredient(req, res, next) {
    try {
      const result = await menuService.addRecipeIngredient(req.params.id, req.body.ingredient_id, req.body);

      res.status(201).json({
        success: true,
        message: 'Recipe ingredient added successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecipe(req, res, next) {
    try {
      const result = await menuService.getMenuItemRecipe(req.params.id);

      res.json({
        success: true,
        message: 'Recipe retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async removeRecipeIngredient(req, res, next) {
    try {
      const result = await menuService.deleteRecipeIngredient(req.params.id, req.body.ingredient_id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MenuController();
