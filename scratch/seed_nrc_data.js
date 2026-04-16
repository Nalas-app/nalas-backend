const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function seed() {
  const dataPath = path.join(__dirname, 'nrc_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found at:', dataPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const client = await pool.connect();

  try {
    // 0. Ensure unique constraints exist for idempotent seeding
    console.log('Ensuring unique name constraints...');
    try {
        await client.query('ALTER TABLE ingredients ADD CONSTRAINT unique_ingredient_name UNIQUE (name)');
    } catch (e) { /* ignore if exists */ }
    try {
        await client.query('ALTER TABLE menu_items ADD CONSTRAINT unique_menu_item_name UNIQUE (name)');
    } catch (e) { /* ignore if exists */ }

    await client.query('BEGIN');

    console.log(`Seeding ${data.ingredients.length} ingredients...`);
    const ingredientMap = new Map();

    const normalize = (str) => str.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

    for (const ing of data.ingredients) {
        // Skip header rows if they leaked into JSON
        if (ing.name.toLowerCase() === 'name' || ing.name.toLowerCase() === 'description') continue;

        const res = await client.query(`
            INSERT INTO ingredients (name, category, unit, current_price_per_unit)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name) DO UPDATE SET 
                category = EXCLUDED.category,
                current_price_per_unit = EXCLUDED.current_price_per_unit
            RETURNING id, name
        `, [ing.name, ing.category, ing.unit, ing.price]);
        
        const id = res.rows[0].id;
        const name = res.rows[0].name;
        ingredientMap.set(normalize(name), id);
    }

    console.log(`Seeding ${data.menu_items.length} menu items...`);
    const itemMap = new Map();

    for (const item of data.menu_items) {
        const res = await client.query(`
            INSERT INTO menu_items (name, base_unit, min_quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE SET
                base_unit = EXCLUDED.base_unit
            RETURNING id, name
        `, [item.name, 'portion', 1]);
        itemMap.set(res.rows[0].name, res.rows[0].id);
    }

    console.log(`Seeding ${data.recipes.length} recipe rows...`);
    let matchedCount = 0;
    for (const recipe of data.recipes) {
        const itemId = itemMap.get(recipe.menu_item);
        const normalizedIngName = normalize(recipe.ingredient);
        let ingId = ingredientMap.get(normalizedIngName);
        
        if (itemId) {
            if (!ingId) {
                // Auto-create missing ingredient
                const missingRes = await client.query(`
                    INSERT INTO ingredients (name, category, unit, current_price_per_unit)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                `, [recipe.ingredient, 'Other', 'kg', 0]);
                ingId = missingRes.rows[0].id;
                ingredientMap.set(normalizedIngName, ingId);
            }
            
            const normalizedQty = recipe.qty_25 / 25;
            
            await client.query(`
                INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit)
                VALUES ($1, $2, $3)
                ON CONFLICT (menu_item_id, ingredient_id) DO UPDATE SET
                    quantity_per_base_unit = EXCLUDED.quantity_per_base_unit
            `, [itemId, ingId, normalizedQty]);
            matchedCount++;
        }
    }
    console.log(`Successfully matched and seeded ${matchedCount} out of ${data.recipes.length} recipes.`);

    await client.query('COMMIT');
    console.log('Seeding complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
