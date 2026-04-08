require('dotenv').config();
const db = require('../config/database');
const logger = require('../shared/utils/logger');

async function validateStockData() {
  logger.info('Starting cross-module data validation...');

  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Validate Stock Adjustments vs Actual Stock
    logger.info('Validating stock quantities against transaction history...');
    
    const stockDiscrepancies = await client.query(`
      WITH TransactionSums AS (
        SELECT 
          ingredient_id,
          SUM(
            CASE 
              WHEN transaction_type IN ('purchase', 'adjustment') THEN quantity
              WHEN transaction_type IN ('consumption', 'wastage') THEN -quantity
              ELSE 0
            END
          ) as calculated_stock
        FROM stock_transactions
        GROUP BY ingredient_id
      )
      SELECT 
        i.id,
        i.name,
        i.available_quantity,
        COALESCE(ts.calculated_stock, 0) as expected_quantity
      FROM ingredients i
      LEFT JOIN TransactionSums ts ON i.id = ts.ingredient_id
      WHERE i.available_quantity != COALESCE(ts.calculated_stock, 0)
    `);

    if (stockDiscrepancies.rows.length > 0) {
      logger.warn(`Found ${stockDiscrepancies.rows.length} stock discrepancies:`);
      stockDiscrepancies.rows.forEach(row => {
        logger.warn(`- ${row.name} (ID: ${row.id}): has ${row.available_quantity}, but transactions sum to ${row.expected_quantity}`);
      });
    } else {
      logger.info('All stock quantities match transaction history.');
    }

    // 2. Validate Order Quantities against Stock Consumption
    // Add additional cross-module checks here based on logic

    await client.query('COMMIT');
    logger.info('Cross-module data validation completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error during data validation:', error);
    if (require.main === module) process.exit(1);
    throw error;
  } finally {
    client.release();
    if (require.main === module) process.exit(0);
  }
}

if (require.main === module) {
  validateStockData();
}

module.exports = { validateStockData };
