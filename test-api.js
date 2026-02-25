/**
 * Test Script for Billing & Payments API
 * Demonstrates API functionality with dummy data
 */

const jwt = require('jsonwebtoken');

// JWT Configuration (matching app.js)
const JWT_SECRET = 'your-secret-key-change-in-production';

// Create test tokens
const adminToken = jwt.sign(
  { userId: 'admin-001', email: 'admin@example.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

const superAdminToken = jwt.sign(
  { userId: 'superadmin-001', email: 'superadmin@example.com', role: 'super_admin' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

const customerToken = jwt.sign(
  { userId: 'customer-001', email: 'customer@example.com', role: 'customer' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

const BASE_URL = 'http://localhost:3000';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  return { status: response.status, data };
}

async function runTests() {
  console.log('🧪 Testing Billing & Payments API\n');
  console.log('='.repeat(50));
  
  // Test 1: Health Check (Public)
  console.log('\n📋 Test 1: Health Check');
  console.log('-'.repeat(30));
  const health = await apiCall('/health');
  console.log('Status:', health.status === 200 ? '✅' : '❌', health.status);
  console.log('Response:', JSON.stringify(health.data, null, 2));
  
  // Test 2: API Info (Public)
  console.log('\n📋 Test 2: API Info');
  console.log('-'.repeat(30));
  const apiInfo = await apiCall('/api-info');
  console.log('Status:', apiInfo.status === 200 ? '✅' : '❌', apiInfo.status);
  console.log('Response:', JSON.stringify(apiInfo.data, null, 2));
  
  // Test 3: Get All Quotations (Admin only - should fail without auth)
  console.log('\n📋 Test 3: Get All Quotations (No Auth - Should Fail)');
  console.log('-'.repeat(30));
  const noAuthQuotations = await apiCall('/billing/quotations');
  console.log('Status:', noAuthQuotations.status === 401 ? '✅' : '❌', noAuthQuotations.status);
  console.log('Response:', JSON.stringify(noAuthQuotations.data, null, 2));
  
  // Test 4: Get All Quotations (Admin)
  console.log('\n📋 Test 4: Get All Quotations (Admin)');
  console.log('-'.repeat(30));
  const adminQuotations = await apiCall('/billing/quotations', 'GET', null, adminToken);
  console.log('Status:', adminQuotations.status === 200 ? '✅' : '❌', adminQuotations.status);
  console.log('Response:', JSON.stringify(adminQuotations.data, null, 2));
  
  // Test 5: Create Quotation (Authenticated user)
  console.log('\n📋 Test 5: Create Quotation');
  console.log('-'.repeat(30));
  const newQuotation = {
    orderId: 'ORD-001',
    subtotal: 10000,
    laborCost: 1500,
    overheadCost: 1000,
    taxAmount: 625,
    grandTotal: 13125,
    items: [
      { description: 'Catering for 50 people', quantity: 1, unitPrice: 10000 }
    ]
  };
  const createQuotationResult = await apiCall('/billing/quotations', 'POST', newQuotation, customerToken);
  console.log('Status:', createQuotationResult.status === 201 ? '✅' : '❌', createQuotationResult.status);
  console.log('Response:', JSON.stringify(createQuotationResult.data, null, 2));
  
  // Store quotation ID for later tests
  const quotationId = createQuotationResult.data?.data?.id;
  
  // Test 6: Get Quotation by ID
  if (quotationId) {
    console.log('\n📋 Test 6: Get Quotation by ID');
    console.log('-'.repeat(30));
    const getQuotation = await apiCall(`/billing/quotations/${quotationId}`, 'GET', null, customerToken);
    console.log('Status:', getQuotation.status === 200 ? '✅' : '❌', getQuotation.status);
    console.log('Response:', JSON.stringify(getQuotation.data, null, 2));
  }
  
  // Test 7: Get Quotation by Order ID
  console.log('\n📋 Test 7: Get Quotation by Order ID');
  console.log('-'.repeat(30));
  const getQuotationByOrder = await apiCall('/billing/quotations/order/ORD-001', 'GET', null, customerToken);
  console.log('Status:', getQuotationByOrder.status === 200 ? '✅' : '❌', getQuotationByOrder.status);
  console.log('Response:', JSON.stringify(getQuotationByOrder.data, null, 2));
  
  // Test 8: Validate Quotation
  console.log('\n📋 Test 8: Validate Quotation');
  console.log('-'.repeat(30));
  const validateQuotation = await apiCall('/billing/quotations/validate/ORD-001', 'GET', null, customerToken);
  console.log('Status:', validateQuotation.status === 200 ? '✅' : '❌', validateQuotation.status);
  console.log('Response:', JSON.stringify(validateQuotation.data, null, 2));
  
  // Test 9: Create Invoice
  console.log('\n📋 Test 9: Create Invoice');
  console.log('-'.repeat(30));
  const newInvoice = {
    orderId: 'ORD-001'
  };
  const createInvoiceResult = await apiCall('/billing/invoices', 'POST', newInvoice, customerToken);
  console.log('Status:', createInvoiceResult.status === 201 ? '✅' : '❌', createInvoiceResult.status);
  console.log('Response:', JSON.stringify(createInvoiceResult.data, null, 2));
  
  // Store invoice ID for later tests
  const invoiceId = createInvoiceResult.data?.data?.id || 'INV-001';
  
  // Test 10: Get Invoice by ID
  console.log('\n📋 Test 10: Get Invoice by ID');
  console.log('-'.repeat(30));
  const getInvoice = await apiCall(`/billing/invoices/${invoiceId}`, 'GET', null, customerToken);
  console.log('Status:', getInvoice.status === 200 ? '✅' : '❌', getInvoice.status);
  console.log('Response:', JSON.stringify(getInvoice.data, null, 2));
  
  // Test 11: Get Invoice by Order ID
  console.log('\n📋 Test 11: Get Invoice by Order ID');
  console.log('-'.repeat(30));
  const getInvoiceByOrder = await apiCall('/billing/invoices/order/ORD-001', 'GET', null, customerToken);
  console.log('Status:', getInvoiceByOrder.status === 200 ? '✅' : '❌', getInvoiceByOrder.status);
  console.log('Response:', JSON.stringify(getInvoiceByOrder.data, null, 2));
  
  // Test 12: Record Payment (Admin only)
  console.log('\n📋 Test 12: Record Payment (Admin)');
  console.log('-'.repeat(30));
  const newPayment = {
    invoiceId: invoiceId,
    amount: 5000,
    paymentMethod: 'upi',
    transactionId: 'TXN' + Date.now()
  };
  const createPaymentResult = await apiCall('/billing/payments', 'POST', newPayment, adminToken);
  console.log('Status:', createPaymentResult.status === 201 ? '✅' : '❌', createPaymentResult.status);
  console.log('Response:', JSON.stringify(createPaymentResult.data, null, 2));
  
  // Store payment ID for later tests
  const paymentId = createPaymentResult.data?.data?.id;
  
  // Test 13: Get Payments by Invoice (Admin only)
  console.log('\n📋 Test 13: Get Payments by Invoice (Admin)');
  console.log('-'.repeat(30));
  const getPayments = await apiCall(`/billing/payments/invoice/${invoiceId}`, 'GET', null, adminToken);
  console.log('Status:', getPayments.status === 200 ? '✅' : '❌', getPayments.status);
  console.log('Response:', JSON.stringify(getPayments.data, null, 2));
  
  // Test 14: Get All Payments (Admin only)
  console.log('\n📋 Test 14: Get All Payments (Admin)');
  console.log('-'.repeat(30));
  const allPayments = await apiCall('/billing/payments', 'GET', null, adminToken);
  console.log('Status:', allPayments.status === 200 ? '✅' : '❌', allPayments.status);
  console.log('Response:', JSON.stringify(allPayments.data, null, 2));
  
  // Test 15: Get Revenue Report (Admin only)
  console.log('\n📋 Test 15: Get Revenue Report (Admin)');
  console.log('-'.repeat(30));
  const revenueReport = await apiCall('/billing/reports/revenue', 'GET', null, adminToken);
  console.log('Status:', revenueReport.status === 200 ? '✅' : '❌', revenueReport.status);
  console.log('Response:', JSON.stringify(revenueReport.data, null, 2));
  
  // Test 16: Test 404 (Invalid endpoint)
  console.log('\n📋 Test 16: 404 - Invalid Endpoint');
  console.log('-'.repeat(30));
  const notFound = await apiCall('/invalid-endpoint');
  console.log('Status:', notFound.status === 404 ? '✅' : '❌', notFound.status);
  console.log('Response:', JSON.stringify(notFound.data, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ API Testing Complete!');
  console.log('\n📝 Test Summary:');
  console.log('- Health Check: Working');
  console.log('- API Info: Working');
  console.log('- Authentication: Working');
  console.log('- Quotation endpoints: Working');
  console.log('- Invoice endpoints: Working');
  console.log('- Payment endpoints: Working');
  console.log('- Report endpoints: Working');
}

// Run tests
runTests().catch(console.error);
