const { pool } = require('./src/config/database');

async function seedBiryani() {
  let client;
  try {
    client = await pool.connect();
    // Check if Biryani already exists
    const existing = await client.query('SELECT id FROM menu_items WHERE name = \'Mutton Biryani\'');
    if (existing.rows.length > 0) {
      console.log('SUCCESS! Biryani Menu ID (Already Exists):', existing.rows[0].id);
      return;
    }

    await client.query('BEGIN');
    
    const riceRes = await client.query("INSERT INTO ingredients (name, unit, current_price_per_unit, reorder_level) VALUES ('Basmati Rice', 'kg', 150, 50) RETURNING id");
    const muttonRes = await client.query("INSERT INTO ingredients (name, unit, current_price_per_unit, reorder_level) VALUES ('Mutton', 'kg', 800, 20) RETURNING id");
    const spicesRes = await client.query("INSERT INTO ingredients (name, unit, current_price_per_unit, reorder_level) VALUES ('Biryani Spices', 'kg', 500, 5) RETURNING id");
    
    const riceId = riceRes.rows[0].id;
    const muttonId = muttonRes.rows[0].id;
    const spicesId = spicesRes.rows[0].id;

    await client.query("INSERT INTO current_stock (ingredient_id, available_quantity) VALUES ($1, 200)", [riceId]);
    await client.query("INSERT INTO current_stock (ingredient_id, available_quantity) VALUES ($1, 100)", [muttonId]);
    await client.query("INSERT INTO current_stock (ingredient_id, available_quantity) VALUES ($1, 50)", [spicesId]);

    const menuRes = await client.query("INSERT INTO menu_items (name, description, base_unit) VALUES ('Mutton Biryani', 'Authentic Dum Biryani', 'plate') RETURNING id");
    const menuId = menuRes.rows[0].id;

    await client.query("INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit, wastage_factor) VALUES ($1, $2, 0.25, 1.0)", [menuId, riceId]);
    await client.query("INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit, wastage_factor) VALUES ($1, $2, 0.2, 1.0)", [menuId, muttonId]);
    await client.query("INSERT INTO recipes (menu_item_id, ingredient_id, quantity_per_base_unit, wastage_factor) VALUES ($1, $2, 0.05, 1.0)", [menuId, spicesId]);

    await client.query('COMMIT');
    console.log('SUCCESS! \n\nYOUR NEW MENU ITEM ID IS:', menuId);
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error('ERROR SEEDING:', e);
  } finally {
    if (client) client.release();
    pool.end();
  }
}
seedBiryani();
