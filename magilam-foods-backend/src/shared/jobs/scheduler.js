const cron = require('node-cron');
const logger = require('../utils/logger');
const stockService = require('../../modules/stock/service');
const billingService = require('../../modules/billing/service');

/**
 * Initialize all cron jobs for the application.
 * "Verify cron jobs on production" can be done by checking the logs
 * for the [CRON] prefix.
 */
const initCronJobs = () => {
    logger.info('[CRON] Initializing background jobs');

    // Job 1: Check for low stock alerts (Run every morning at 8:00 AM)
    // 0 8 * * *
    cron.schedule('0 8 * * *', async () => {
        try {
            logger.info('[CRON] Running daily low stock check');
            const alerts = await stockService.getProcurementAlerts();
            
            if (alerts.length > 0) {
                logger.warn(`[CRON] ${alerts.length} ingredients are below reorder level`, { alerts });
                // In a real app, this would trigger an email/notification
            } else {
                logger.info('[CRON] All stock levels are within normal range');
            }
        } catch (error) {
            logger.error('[CRON] Error in low stock check job:', error);
        }
    });

    // Job 2: Health check job to verify crons are running (Run every hour)
    // 0 * * * *
    cron.schedule('0 * * * *', () => {
        logger.info('[CRON] Hourly health check - Background worker is active');
    });

    // Job 3: Daily cleanup (e.g., stale quotations) - (Run at 1:00 AM)
    // 0 1 * * *
    cron.schedule('0 1 * * *', async () => {
        try {
            logger.info('[CRON] Running daily cleanup tasks');
            // Placeholder: Add logic to mark quotations as expired if past valid_until
        } catch (error) {
            logger.error('[CRON] Error in cleanup job:', error);
        }
    });

    logger.info('[CRON] All jobs scheduled successfully');
};

module.exports = { initCronJobs };
