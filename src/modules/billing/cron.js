const cron = require('node-cron');
const billingRepository = require('./repository');
const logger = require('../../shared/utils/logger');

// Schedule job to run at 00:00 every day
const startBillingCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running cron job: Marking overdue invoices');
    try {
      const updatedInvoices = await billingRepository.updateOverdueInvoices();
      if (updatedInvoices.length > 0) {
        logger.info(`Successfully marked ${updatedInvoices.length} invoices as overdue.`);
      } else {
        logger.info('No overdue invoices found today.');
      }
    } catch (error) {
      logger.error('Error executing overdue invoices cron job:', error.message);
    }
  });
  
  logger.info('Billing cron jobs initialized.');
};

module.exports = {
  startBillingCronJobs
};
