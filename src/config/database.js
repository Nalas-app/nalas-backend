const { Pool } = require('pg');
const logger = require('../shared/utils/logger');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10, // Optimized for Supabase Free Tier
  idleTimeoutMillis: 10000, // Close idle connections faster
  connectionTimeoutMillis: 5000, 
  ssl: { rejectUnauthorized: false }, // Ensure SSL stability in cloud
  keepAlive: true, // Prevent pooler from killing active connections
});

pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};