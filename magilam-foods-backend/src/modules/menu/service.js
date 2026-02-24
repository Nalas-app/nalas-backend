const AppError = require('../../shared/errors/AppError');
const menuRepository = require('./repository');
const stockRepository = require('../stock/repository');

class MenuService {
  // ===== CATEGORIES =====
  async createCategory(data) {
    const category = await menuRepository.createCategory(data);

    if (!category) {
      throw AppError.internal('Failed to create category');
    }

    return {
      id: category.id,
      name: category.name,
      display_order: category.display_order,
      is_active: category.is_active,
      created_at: category.created_at
    };
  }

  async getCategoryById(categoryId) {
    const category = await menuRepository.findCategoryById(categoryId);

    if (!category) {
      throw AppError.notFound('Category');
    }

    return {
      id: category.id,
      name: category.name,
      display_order: category.display_order,
      is_active: category.is_active
    };
  }

  async getAllCategories(isActive = true) {
    const categories = await menuRepository.findAllCategories(isActive);

    return categories.map(c => ({
      id: c.id,
      name: c.name,
      display_order: c.display_order,
      is_active: c.is_active
    }));
  }

  async updateCategory(categoryId, data) {
    const category = await menuRepository.findCategoryById(categoryId);

    if (!category) {
      throw AppError.notFound('Category');
    }

    const updated = await menuRepository.updateCategory(categoryId, data);

    return {
      id: updated.id,
      name: updated.name,
      display_order: updated.display_order,
      is_active: updated.is_active
    };
  }

  async deleteCategory(categoryId) {
    const category = await menuRepository.findCategoryById(categoryId);

    if (!category) {
      throw AppError.notFound('Category');
    }

    await menuRepository.deleteCategory(categoryId);

    return { message: 'Category deleted successfully' };
  }

  // ===== MENU ITEMS =====
  async createMenuItem(data) {
    const category = await menuRepository.findCategoryById(data.category_id);

    if (!category) {
      throw AppError.notFound('Category');
    }

    const menuItem = await menuRepository.createMenuItem(data);

    if (!menuItem) {
      throw AppError.internal('Failed to create menu item');
    }

    return {
      id: menuItem.id,
      category_id: menuItem.category_id,
      category_name: category.name,
      name: menuItem.name,
      description: menuItem.description,
      base_unit: menuItem.base_unit,
      min_quantity: menuItem.min_quantity,
      image_url: menuItem.image_url,
      is_customizable: menuItem.is_customizable,
      is_active: menuItem.is_active,
      created_at: menuItem.created_at
    };
  }

  async getMenuItemById(itemId) {
    const menuItem = await menuRepository.findMenuItemById(itemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    const recipe = await menuRepository.getRecipe(itemId);

    return {
      id: menuItem.id,
      category_id: menuItem.category_id,
      category_name: menuItem.category_name,
      name: menuItem.name,
      description: menuItem.description,
      base_unit: menuItem.base_unit,
      min_quantity: menuItem.min_quantity,
      image_url: menuItem.image_url,
      is_customizable: menuItem.is_customizable,
      is_active: menuItem.is_active,
      recipe: recipe.map(r => ({
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient_name,
        unit: r.unit,
        quantity_per_base_unit: r.quantity_per_base_unit,
        wastage_factor: r.wastage_factor,
        cost_per_unit: r.current_price_per_unit
      })),
      created_at: menuItem.created_at
    };
  }

  async getAllMenuItems(filters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const items = await menuRepository.findAllMenuItems(filters, limit, offset);

    return items.map(item => ({
      id: item.id,
      category_id: item.category_id,
      category_name: item.category_name,
      name: item.name,
      description: item.description,
      base_unit: item.base_unit,
      min_quantity: item.min_quantity,
      is_customizable: item.is_customizable,
      is_active: item.is_active
    }));
  }

  async updateMenuItem(itemId, data) {
    const menuItem = await menuRepository.findMenuItemById(itemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    if (data.category_id) {
      const category = await menuRepository.findCategoryById(data.category_id);
      if (!category) {
        throw AppError.notFound('Category');
      }
    }

    const updated = await menuRepository.updateMenuItem(itemId, data);

    const recipe = await menuRepository.getRecipe(itemId);

    return {
      id: updated.id,
      category_id: updated.category_id,
      name: updated.name,
      description: updated.description,
      base_unit: updated.base_unit,
      min_quantity: updated.min_quantity,
      is_customizable: updated.is_customizable,
      is_active: updated.is_active,
      recipe_count: recipe.length
    };
  }

  async deleteMenuItem(itemId) {
    const menuItem = await menuRepository.findMenuItemById(itemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    await menuRepository.deleteAllRecipes(itemId);
    await menuRepository.deleteMenuItem(itemId);

    return { message: 'Menu item deleted successfully' };
  }

  // ===== RECIPES =====
  async addRecipeIngredient(menuItemId, ingredientId, data) {
    const menuItem = await menuRepository.findMenuItemById(menuItemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    const ingredient = await stockRepository.findIngredientById(ingredientId);

    if (!ingredient) {
      throw AppError.notFound('Ingredient');
    }

    const recipeItem = await menuRepository.createRecipeItem(menuItemId, ingredientId, data);

    return {
      menu_item_id: menuItemId,
      ingredient_id: ingredientId,
      ingredient_name: ingredient.name,
      quantity_per_base_unit: recipeItem.quantity_per_base_unit,
      wastage_factor: recipeItem.wastage_factor,
      cost_per_unit: ingredient.current_price_per_unit
    };
  }

  async getMenuItemRecipe(menuItemId) {
    const menuItem = await menuRepository.findMenuItemById(menuItemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    const recipe = await menuRepository.getRecipe(menuItemId);

    return {
      menu_item_id: menuItemId,
      menu_item_name: menuItem.name,
      base_unit: menuItem.base_unit,
      ingredients: recipe.map(r => ({
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient_name,
        unit: r.unit,
        quantity_per_base_unit: r.quantity_per_base_unit,
        wastage_factor: r.wastage_factor,
        cost_per_unit: r.current_price_per_unit,
        total_cost_with_wastage: (r.quantity_per_base_unit * r.wastage_factor) * r.current_price_per_unit
      }))
    };
  }

  async deleteRecipeIngredient(menuItemId, ingredientId) {
    const menuItem = await menuRepository.findMenuItemById(menuItemId);

    if (!menuItem) {
      throw AppError.notFound('Menu Item');
    }

    const removed = await menuRepository.deleteRecipeItem(menuItemId, ingredientId);

    if (!removed) {
      throw AppError.notFound('Recipe ingredient');
    }

    return { message: 'Recipe ingredient removed successfully' };
  }
}

module.exports = new MenuService();
