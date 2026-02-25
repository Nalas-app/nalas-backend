/**
 * PDF Generation Service
 * Generates PDF documents for Quotations and Invoices
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Directory for storing PDFs
const PDF_DIR = path.join(__dirname, '../../public/pdfs');

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

/**
 * Generate PDF for Quotation
 * @param {Object} quotation - Quotation data
 * @param {Object} order - Order data
 * @param {Object} customer - Customer data
 * @returns {Promise<string>} - PDF file path
 */
const generateQuotationPDF = async (quotation, order, customer) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `quotation_${quotation.quotation_number.replace(/-/g, '')}.pdf`;
      const filePath = path.join(PDF_DIR, fileName);
      
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(24).text('MAGILAM FOODS', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).text('Quotation', { align: 'center' });
      
      // Draw line
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      
      // Quotation Details
      doc.fontSize(12);
      doc.text(`Quotation #: ${quotation.quotation_number}`, 50);
      doc.text(`Date: ${formatDate(quotation.created_at)}`, 50);
      doc.text(`Valid Until: ${formatDate(quotation.valid_until)}`, 50);
      
      doc.moveDown(1);
      
      // Customer Details
      doc.fontSize(14).text('Customer Details:', { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${customer.full_name || 'N/A'}`);
      doc.text(`Email: ${customer.email || 'N/A'}`);
      doc.text(`Event Date: ${order.event_date ? formatDate(order.event_date) : 'N/A'}`);
      doc.text(`Guests: ${order.guest_count || 'N/A'}`);
      doc.text(`Venue: ${order.venue_address || 'N/A'}`);
      
      doc.moveDown(1);
      
      // Pricing Table Header
      const tableTop = doc.y;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Amount (₹)', 400, tableTop, { width: 100, align: 'right' });
      
      doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
      doc.moveDown(2);
      
      // Pricing Details
      doc.font('Helvetica').fontSize(11);
      let y = doc.y;
      
      doc.text('Subtotal', 50, y);
      doc.text(formatCurrency(quotation.subtotal), 400, y, { width: 100, align: 'right' });
      y += 20;
      
      if (quotation.labor_cost > 0) {
        doc.text('Labor Cost', 50, y);
        doc.text(formatCurrency(quotation.labor_cost), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (quotation.overhead_cost > 0) {
        doc.text('Overhead Cost', 50, y);
        doc.text(formatCurrency(quotation.overhead_cost), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (quotation.discount > 0) {
        doc.text('Discount', 50, y);
        doc.text(`-${formatCurrency(quotation.discount)}`, 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (quotation.tax_amount > 0) {
        doc.text('Tax', 50, y);
        doc.text(formatCurrency(quotation.tax_amount), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      // Grand Total
      doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
      y += 20;
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('GRAND TOTAL', 50, y);
      doc.text(formatCurrency(quotation.grand_total), 400, y, { width: 100, align: 'right' });
      
      // Footer
      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Valid until ${formatDate(quotation.valid_until)}`, { align: 'center' });
      doc.text('Thank you for your business!', { align: 'center' });
      
      // Finalize
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/pdfs/${fileName}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate PDF for Invoice
 * @param {Object} invoice - Invoice data
 * @param {Object} order - Order data
 * @param {Object} customer - Customer data
 * @returns {Promise<string>} - PDF file path
 */
const generateInvoicePDF = async (invoice, order, customer) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `invoice_${invoice.invoice_number.replace(/-/g, '')}.pdf`;
      const filePath = path.join(PDF_DIR, fileName);
      
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(24).text('MAGILAM FOODS', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).text('INVOICE', { align: 'center' });
      
      // Draw line
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
      
      // Invoice Details
      doc.fontSize(12);
      doc.text(`Invoice #: ${invoice.invoice_number}`, 50);
      doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 50);
      doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 50);
      
      doc.moveDown(1);
      
      // Customer Details
      doc.fontSize(14).text('Bill To:', { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${customer.full_name || 'N/A'}`);
      doc.text(`Email: ${customer.email || 'N/A'}`);
      doc.text(`Event Date: ${order.event_date ? formatDate(order.event_date) : 'N/A'}`);
      doc.text(`Guests: ${order.guest_count || 'N/A'}`);
      doc.text(`Venue: ${order.venue_address || 'N/A'}`);
      
      doc.moveDown(1);
      
      // Pricing Table Header
      const tableTop = doc.y;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Amount (₹)', 400, tableTop, { width: 100, align: 'right' });
      
      doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
      doc.moveDown(2);
      
      // Pricing Details
      doc.font('Helvetica').fontSize(11);
      let y = doc.y;
      
      doc.text('Subtotal', 50, y);
      doc.text(formatCurrency(invoice.subtotal), 400, y, { width: 100, align: 'right' });
      y += 20;
      
      if (invoice.labor_cost > 0) {
        doc.text('Labor Cost', 50, y);
        doc.text(formatCurrency(invoice.labor_cost), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (invoice.overhead_cost > 0) {
        doc.text('Overhead Cost', 50, y);
        doc.text(formatCurrency(invoice.overhead_cost), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (invoice.discount > 0) {
        doc.text('Discount', 50, y);
        doc.text(`-${formatCurrency(invoice.discount)}`, 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      if (invoice.tax_amount > 0) {
        doc.text('Tax', 50, y);
        doc.text(formatCurrency(invoice.tax_amount), 400, y, { width: 100, align: 'right' });
        y += 20;
      }
      
      // Grand Total
      doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
      y += 20;
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('GRAND TOTAL', 50, y);
      doc.text(formatCurrency(invoice.grand_total), 400, y, { width: 100, align: 'right' });
      
      // Payment Status
      y += 30;
      doc.fontSize(12);
      doc.text(`Payment Status: ${invoice.payment_status.toUpperCase()}`, 50, y);
      doc.text(`Amount Paid: ${formatCurrency(invoice.paid_amount)}`, 50, y + 20);
      doc.text(`Outstanding: ${formatCurrency(invoice.grand_total - invoice.paid_amount)}`, 50, y + 40);
      
      // Footer
      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica');
      doc.text('Payment is due by ' + formatDate(invoice.due_date), { align: 'center' });
      doc.text('Thank you for your business!', { align: 'center' });
      
      // Finalize
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/pdfs/${fileName}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

module.exports = {
  generateQuotationPDF,
  generateInvoicePDF
};
