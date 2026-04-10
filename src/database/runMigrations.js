const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../shared/utils/logger');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  logger.info(`Starting migrations from ${migrationsDir}...`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      logger.info(`Executing migration: ${file}`);
      
      // Execute each file
      await client.query(sql);
      logger.info(`Successfully completed: ${file}`);
    }

    await client.query('COMMIT');
    logger.info('All migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed. Rolled back changes.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Unhandled migration error:', err);
  process.exit(1);
});
