/**
 * Application Configuration
 */

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  },
  
  // Quotation settings
  quotation: {
    validityDays: 7
  },
  
  // Invoice settings
  invoice: {
    dueDays: 15
  }
};
