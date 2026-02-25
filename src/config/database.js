/**
 * Database Configuration
 * Uses pg (node-postgres) native PostgreSQL driver
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'billing_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: process.env.DB_MAX_CONNECTIONS || 20,
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000,
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT || 2000,
});

// Test connection
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
