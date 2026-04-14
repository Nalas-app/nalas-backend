/**
 * Dashboard Stats Controller
 * GET /api/v1/dashboard/stats
 * Returns aggregated stats for the admin dashboard.
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/rbac.middleware');
const logger = require('../../shared/utils/logger');

const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function q(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/dashboard/stats
 * Returns:
 *   - orders by status
 *   - total revenue (confirmed + completed)
 *   - revenue this month
 *   - pending payments (invoices not fully paid)
 *   - low stock alerts
 *   - recent orders (last 5)
 *   - ml predictions count
 */
router.get('/stats', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    // Orders summary
    const orderStats = await q(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')      AS draft_count,
        COUNT(*) FILTER (WHERE status = 'quoted')     AS quoted_count,
        COUNT(*) FILTER (WHERE status = 'confirmed')  AS confirmed_count,
        COUNT(*) FILTER (WHERE status = 'preparing')  AS preparing_count,
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled_count,
        COUNT(*)                                       AS total_count
      FROM orders
    `);

    // Revenue
    const revenueStats = await q(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('confirmed','preparing','completed')), 0) AS total_revenue,
        COALESCE(SUM(total_amount) FILTER (
          WHERE status IN ('confirmed','preparing','completed')
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
        ), 0) AS revenue_this_month
      FROM orders
    `);

    // Pending payments
    const pendingPayments = await q(`
      SELECT
        COUNT(*) AS pending_invoice_count,
        COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) AS pending_amount
      FROM invoices
      WHERE payment_status IN ('pending', 'partial', 'overdue')
    `);

    // Low stock alerts (below reorder level)
    const stockAlerts = await q(`
      SELECT
        i.name,
        i.unit,
        i.reorder_level,
        cs.available_quantity,
        CASE
          WHEN cs.available_quantity <= i.reorder_level * 0.5 THEN 'CRITICAL'
          ELSE 'LOW'
        END AS severity
      FROM ingredients i
      JOIN current_stock cs ON cs.ingredient_id = i.id
      WHERE cs.available_quantity <= i.reorder_level
      ORDER BY cs.available_quantity ASC
      LIMIT 10
    `);

    // Recent orders
    const recentOrders = await q(`
      SELECT
        o.id,
        o.event_type,
        o.event_date,
        o.guest_count,
        o.status,
        o.total_amount,
        o.created_at
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // ML predictions count
    const mlStats = await q(`
      SELECT COUNT(*) AS total_predictions FROM ml_cost_predictions
    `);

    const os = orderStats[0];
    const rs = revenueStats[0];
    const pp = pendingPayments[0];
    const ml = mlStats[0];

    res.json({
      success: true,
      data: {
        orders: {
          total: parseInt(os.total_count),
          by_status: {
            draft: parseInt(os.draft_count),
            quoted: parseInt(os.quoted_count),
            confirmed: parseInt(os.confirmed_count),
            preparing: parseInt(os.preparing_count),
            completed: parseInt(os.completed_count),
            cancelled: parseInt(os.cancelled_count),
          },
          pending_actions: parseInt(os.draft_count) + parseInt(os.quoted_count),
        },
        revenue: {
          total: parseFloat(rs.total_revenue),
          this_month: parseFloat(rs.revenue_this_month),
        },
        billing: {
          pending_invoice_count: parseInt(pp.pending_invoice_count),
          pending_amount: parseFloat(pp.pending_amount),
        },
        stock: {
          low_stock_alerts: stockAlerts.length,
          alerts: stockAlerts.map(a => ({
            name: a.name,
            unit: a.unit,
            current: parseFloat(a.available_quantity),
            reorder_level: parseFloat(a.reorder_level),
            severity: a.severity,
          })),
        },
        recent_orders: recentOrders.map(o => ({
          id: o.id,
          event_type: o.event_type,
          event_date: o.event_date,
          guest_count: o.guest_count,
          status: o.status,
          total_amount: parseFloat(o.total_amount || 0),
          created_at: o.created_at,
        })),
        ml: {
          total_predictions: parseInt(ml.total_predictions),
        },
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error:', err.message);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch dashboard stats' } });
  }
});

module.exports = router;
