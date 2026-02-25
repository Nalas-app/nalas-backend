/**
 * Main Entry Point - Billing & Payments API
 * Catering Management System
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const appConfig = require('./config/app');
const db = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const billingRoutes = require('./routes/billingRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    module: 'Billing & Payments'
  });
});

// API Routes
app.use('/billing', billingRoutes);

// Root endpoint - Redirect to frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API info endpoint (moved to /api-info)
app.get('/api-info', (req, res) => {
  res.json({
    message: 'Billing & Payments API',
    version: '1.0.0',
    endpoints: {
      quotations: '/billing/quotations',
      invoices: '/billing/invoices',
      payments: '/billing/payments',
      reports: '/billing/reports'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = appConfig.port || 3000;

const startServer = async () => {
  // Start server without database check for now
  app.listen(PORT, () => {
    console.log(`✅ Billing & Payments API running on port ${PORT}`);
    console.log(`   Environment: ${appConfig.env}`);
    console.log(`\n⚠️  Note: Database connection not tested. Run 'npm run migrate' after setting up PostgreSQL.`);
  });
};

startServer();

module.exports = app;
