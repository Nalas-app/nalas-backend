const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const SEED_DATA_PATH = path.join(__dirname, 'client_data_seed.json');

async function seed() {
  const data = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf8'));
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Starting client data seeding...');

    // 1. Seed Categories
    const categoryMap = {};
    for (const cat of data.categories) {
      const result = await client.query(
        'INSERT INTO menu_categories (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id, name',
        [cat.name]
      );
      
      if (result.rows.length > 0) {
        categoryMap[result.rows[0].name] = result.rows[0].id;
      } else {
        // Fetch ID if it already exists
        const existing = await client.query('SELECT id FROM menu_categories WHERE name = $1', [cat.name]);
        categoryMap[cat.name] = existing.rows[0].id;
      }
    }
    console.log(`✓ Seeded/Mapped ${Object.keys(categoryMap).length} categories.`);

    // 2. Seed Ingredients and Menu Items
    let ingredientCount = 0;
    let menuItemCount = 0;

    for (const item of data.items) {
      // Create Ingredient
      const ingResult = await client.query(
        'INSERT INTO ingredients (name, unit, current_price_per_unit, item_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [item.name, item.unit, item.price, item.type]
      );
      const ingredientId = ingResult.rows[0].id;
      ingredientCount++;

      // Initialize stock for the new ingredient
      await client.query(
        'INSERT INTO current_stock (ingredient_id, available_quantity) VALUES ($1, 0) ON CONFLICT DO NOTHING',
        [ingredientId]
      );

      // If it's a food item, create a Menu Item too
      if (item.type === 'food') {
        const categoryId = categoryMap[item.category];
        await client.query(
          'INSERT INTO menu_items (name, category_id, base_unit, min_quantity) VALUES ($1, $2, $3, $4)',
          [item.name, categoryId, item.unit, 1]
        );
        menuItemCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`✓ successfully seeded ${ingredientCount} ingredients.`);
    console.log(`✓ successfully created ${menuItemCount} menu items.`);
    console.log('Seeding completed successfully! 🚀');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
