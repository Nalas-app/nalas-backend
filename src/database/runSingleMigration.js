const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runSingleMigration(file) {
  const filePath = path.join(__dirname, 'migrations', file);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`Executing migration: ${file}`);
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Successfully completed: ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Migration ${file} failed:`, err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

const migrationFile = process.argv[2] || '003_add_ingredient_type.sql';
runSingleMigration(migrationFile);
