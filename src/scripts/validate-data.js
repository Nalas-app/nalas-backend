const { pool } = require('../config/database');
const logger = require('../shared/utils/logger');

async function validateData() {
  logger.info('Starting Cross-Module Data Validation audit...');

  const client = await pool.connect();
  const errors = [];

  try {
    // Audit 1: Confirmed Orders without Stock Reservations
    const orderStockAudit = await client.query(`
      SELECT o.id, o.status 
      FROM orders o
      LEFT JOIN order_stock_reservations osr ON o.id = osr.order_id
      WHERE o.status IN ('confirmed', 'preparing') AND osr.order_id IS NULL
    `);

    if (orderStockAudit.rows.length > 0) {
      orderStockAudit.rows.forEach(row => {
        errors.push(`CRITICAL: Order ${row.id} is ${row.status} but has NO stock reservations.`);
      });
    }

    // Audit 2: Confirmed Orders without an Invoice
    const orderInvoiceAudit = await client.query(`
      SELECT o.id, o.status
      FROM orders o
      LEFT JOIN invoices i ON o.id = i.order_id
      WHERE o.status IN ('confirmed', 'preparing', 'completed') AND i.id IS NULL
    `);

    if (orderInvoiceAudit.rows.length > 0) {
      orderInvoiceAudit.rows.forEach(row => {
        errors.push(`CRITICAL: Order ${row.id} is confirmed but has NO invoice.`);
      });
    }

    // Audit 3: Mismatch between Order Total and Invoice Total
    const amountMismatchAudit = await client.query(`
      SELECT o.id, o.total_amount as order_total, i.total_amount as invoice_total
      FROM orders o
      JOIN invoices i ON o.id = i.order_id
      WHERE o.total_amount != i.total_amount
    `);

    if (amountMismatchAudit.rows.length > 0) {
      amountMismatchAudit.rows.forEach(row => {
        errors.push(`WARNING: Amount mismatch for order ${row.id}. Order Total: ${row.order_total}, Invoice Total: ${row.invoice_total}`);
      });
    }

    // Audit 4: Payments not linked to valid invoices
    const orphanedPayments = await client.query(`
      SELECT p.id, p.invoice_id
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE i.id IS NULL
    `);

    if (orphanedPayments.rows.length > 0) {
      orphanedPayments.rows.forEach(row => {
        errors.push(`ERROR: Orphaned payment ${row.id} linked to non-existent invoice ${row.invoice_id}.`);
      });
    }

    // Report results
    if (errors.length === 0) {
      logger.info('Audit PASSED: No data inconsistencies found across modules.');
    } else {
      logger.warn(`Audit FAILED: Found ${errors.length} data inconsistencies.`);
      errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (err) {
    logger.error('Error during data validation audit:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

validateData().catch(err => {
  console.error('Unhandled script error:', err);
  process.exit(1);
});
