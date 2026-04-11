const db = require('../../config/database');

class MenuRepository {
  // ===== CATEGORIES =====
  async createCategory(data) {
    const query = `
      INSERT INTO menu_categories (name, display_order, is_active)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.name,
      data.display_order || 0,
      data.is_active !== false
    ]);
    return result.rows[0];
  }

  async findCategoryById(id) {
    const query = 'SELECT * FROM menu_categories WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAllCategories(isActive = true) {
    const query = `
      SELECT * FROM menu_categories 
      WHERE is_active = $1
      ORDER BY display_order ASC
    `;
    const result = await db.query(query, [isActive]);
    return result.rows;
  }

  async updateCategory(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount}`);
      params.push(data.name);
      paramCount++;
    }
    if (data.display_order !== undefined) {
      updates.push(`display_order = $${paramCount}`);
      params.push(data.display_order);
      paramCount++;
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      params.push(data.is_active);
      paramCount++;
    }

    if (updates.length === 0) return this.findCategoryById(id);

    params.push(id);
    const query = `UPDATE menu_categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  async deleteCategory(id) {
    const query = 'DELETE FROM menu_categories WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  // ===== MENU ITEMS =====
  async createMenuItem(data) {
    const query = `
      INSERT INTO menu_items 
      (category_id, name, description, base_unit, min_quantity, image_url, is_customizable, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.category_id,
      data.name,
      data.description || null,
      data.base_unit,
      data.min_quantity || 1,
      data.image_url || null,
      data.is_customizable || false,
      data.is_active !== false
    ]);
    return result.rows[0];
  }

  async findMenuItemById(id) {
    const query = `
      SELECT mi.*, mc.name as category_name 
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAllMenuItems(filters = {}, limit = 10, offset = 0) {
    let query = `
      SELECT mi.*, mc.name as category_name 
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.name) {
      query += ` AND mi.name ILIKE $${params.length + 1}`;
      params.push(`%${filters.name}%`);
    }

    if (filters.category_id) {
      query += ` AND mi.category_id = $${params.length + 1}`;
      params.push(filters.category_id);
    }

    if (filters.is_active !== undefined) {
      query += ` AND mi.is_active = $${params.length + 1}`;
      params.push(filters.is_active);
    }

    if (filters.is_customizable !== undefined) {
      query += ` AND mi.is_customizable = $${params.length + 1}`;
      params.push(filters.is_customizable);
    }

    query += ` ORDER BY mi.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateMenuItem(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount}`);
      params.push(data.name);
      paramCount++;
    }
    if (data.description) {
      updates.push(`description = $${paramCount}`);
      params.push(data.description);
      paramCount++;
    }
    if (data.base_unit) {
      updates.push(`base_unit = $${paramCount}`);
      params.push(data.base_unit);
      paramCount++;
    }
    if (data.min_quantity !== undefined) {
      updates.push(`min_quantity = $${paramCount}`);
      params.push(data.min_quantity);
      paramCount++;
    }
    if (data.image_url !== undefined) {
      updates.push(`image_url = $${paramCount}`);
      params.push(data.image_url || null);
      paramCount++;
    }
    if (data.is_customizable !== undefined) {
      updates.push(`is_customizable = $${paramCount}`);
      params.push(data.is_customizable);
      paramCount++;
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      params.push(data.is_active);
      paramCount++;
    }

    if (updates.length === 0) return this.findMenuItemById(id);

    params.push(id);
    const query = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, params);
    return result.rows[0];
  }

  async deleteMenuItem(id) {
    const query = 'DELETE FROM menu_items WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  // ===== RECIPES =====
  async createRecipeItem(menuItemId, ingredientId, data) {
    const query = `
      INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit, wastage_factor)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await db.query(query, [
      menuItemId,
      ingredientId,
      data.quantity_per_base_unit,
      data.wastage_factor || 1.05
    ]);
    return result.rows[0];
  }

  async getRecipe(menuItemId) {
    const query = `
      SELECT r.*, i.name as ingredient_name, i.unit, i.current_price_per_unit
      FROM recipes r
      LEFT JOIN ingredients i ON r.ingredient_id = i.id
      WHERE r.menu_item_id = $1
      ORDER BY i.name
    `;
    const result = await db.query(query, [menuItemId]);
    return result.rows;
  }

  async deleteRecipeItem(menuItemId, ingredientId) {
    const query = `
      DELETE FROM recipes 
      WHERE menu_item_id = $1 AND ingredient_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [menuItemId, ingredientId]);
    return result.rows[0];
  }

  async deleteAllRecipes(menuItemId) {
    const query = 'DELETE FROM recipes WHERE menu_item_id = $1';
    await db.query(query, [menuItemId]);
  }
}

module.exports = new MenuRepository();
