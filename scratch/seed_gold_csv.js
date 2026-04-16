// seed_gold_csv.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nalas_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i+1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Wiping old data...');
    // Wipe relevant tables
    await client.query('TRUNCATE recipes CASCADE');
    await client.query('TRUNCATE menu_items CASCADE');
    await client.query('TRUNCATE menu_categories CASCADE');
    await client.query('TRUNCATE ingredients CASCADE');

    console.log('Loading Categories...');
    // Insert a default category since the raw datasets didn't specify one
    const catRes = await client.query(`
      INSERT INTO menu_categories (name, display_order, is_active)
      VALUES ($1, $2, $3) RETURNING id
    `, ['Meals & Curries', 1, true]);
    const categoryId = catRes.rows[0].id;

    // 1. Ingredients
    console.log('Seeding Gold Ingredients...');
    const ingData = fs.readFileSync(path.join(__dirname, '../../nrc-datasets/gold/gold_ingredients.csv'), 'utf8');
    const ingLines = ingData.split('\n').filter(l => l.trim());
    const ingIdMap = {};
    for (let i = 1; i < ingLines.length; i++) {
      const parts = parseCSVLine(ingLines[i]);
      if (parts.length < 5) continue;
      const [old_id, name, cat, unit, price, flags] = parts;
      const parsedPrice = parseFloat(price) || 0;
      
      const res = await client.query(`
        INSERT INTO ingredients (name, category, unit, current_price_per_unit)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [name, cat, unit || 'kg', parsedPrice]);
      ingIdMap[old_id] = res.rows[0].id;
    }

    // 2. Menu Items
    console.log('Seeding Gold Menu Items...');
    const menuData = fs.readFileSync(path.join(__dirname, '../../nrc-datasets/gold/gold_menu_items.csv'), 'utf8');
    const menuLines = menuData.split('\n').filter(l => l.trim());
    const menuIdMap = {};
    for (let i = 1; i < menuLines.length; i++) {
      const parts = parseCSVLine(menuLines[i]);
      if (parts.length < 3) continue;
      const [old_id, name, cat, base_unit] = parts;
      
      const res = await client.query(`
        INSERT INTO menu_items (category_id, name, base_unit, min_quantity, is_active)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [categoryId, name, base_unit || '1 portion', 1, true]);
      menuIdMap[old_id] = res.rows[0].id;
    }

    // 3. Recipes
    console.log('Seeding Gold Recipes...');
    const rcpData = fs.readFileSync(path.join(__dirname, '../../nrc-datasets/gold/gold_recipes.csv'), 'utf8');
    const rcpLines = rcpData.split('\n').filter(l => l.trim());
    for (let i = 1; i < rcpLines.length; i++) {
      const parts = parseCSVLine(rcpLines[i]);
      if (parts.length < 4) continue;
      const [old_rcp_id, old_menu_id, old_ing_id, qty, wastage] = parts;
      
      const realMenuId = menuIdMap[old_menu_id];
      const realIngId = ingIdMap[old_ing_id];
      const parsedQty = parseFloat(qty) || 0.0;
      
      if (realMenuId && realIngId) {
        await client.query(`
          INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit, wastage_factor)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (menu_item_id, ingredient_id) 
          DO UPDATE SET quantity_per_base_unit = recipes.quantity_per_base_unit + EXCLUDED.quantity_per_base_unit
        `, [realMenuId, realIngId, parsedQty, 1.05]);
      }
    }

    await client.query('COMMIT');
    console.log('SUCCESS! Gold dataset is fully live in the database.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED to seed data:', e);
  } finally {
    client.release();
    pool.end();
  }
}

run();
