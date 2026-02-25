/**
 * Demo Script for Billing & Payments API
 * Shows expected API responses with sample data
 * No database required - runs in demo mode
 */

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                   Billing & Payments API - Demo Mode                        ║
║                    Catering Management System                                ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

// Sample data that would be returned from the API
const DEMO_DATA = {
  // Health Check
  health: {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'Billing & Payments'
  },

  // API Info
  apiInfo: {
    message: 'Billing & Payments API',
    version: '1.0.0',
    endpoints: {
      quotations: '/billing/quotations',
      invoices: '/billing/invoices',
      payments: '/billing/payments',
      reports: '/billing/reports'
    }
  },

  // Sample Quotations
  quotations: [
    {
      id: 'q-001',
      order_id: 'ord-550e8400-e29b-41d4-a716-446655440000',
      quotation_number: 'QT-2024-001',
      subtotal: 10000,
      labor_cost: 1500,
      overhead_cost: 1000,
      tax_amount: 625,
      grand_total: 13125,
      status: 'pending',
      valid_until: '2024-02-28T23:59:59Z',
      created_at: '2024-02-21T10:30:00Z',
      isExpired: false
    },
    {
      id: 'q-002',
      order_id: 'ord-550e8400-e29b-41d4-a716-446655440001',
      quotation_number: 'QT-2024-002',
      subtotal: 25000,
      labor_cost: 3000,
      overhead_cost: 2000,
      tax_amount: 1450,
      grand_total: 31450,
      status: 'accepted',
      valid_until: '2024-02-25T23:59:59Z',
      created_at: '2024-02-18T14:20:00Z',
      isExpired: false
    },
    {
      id: 'q-003',
      order_id: 'ord-550e8400-e29b-41d4-a716-446655440002',
      quotation_number: 'QT-2024-003',
      subtotal: 5000,
      labor_cost: 750,
      overhead_cost: 500,
      tax_amount: 312.50,
      grand_total: 6562.50,
      status: 'expired',
      valid_until: '2024-02-10T23:59:59Z',
      created_at: '2024-02-03T09:15:00Z',
      isExpired: true
    }
  ],

  // Sample Invoices
  invoices: [
    {
      id: 'inv-001',
      order_id: 'ord-550e8400-e29b-41d4-a716-446655440000',
      invoice_number: 'INV-2024-001',
      quotation_id: 'q-001',
      subtotal: 10000,
      labor_cost: 1500,
      overhead_cost: 1000,
      tax_amount: 625,
      grand_total: 13125,
      paid_amount: 5000,
      outstanding: 8125,
      payment_status: 'partial',
      due_date: '2024-03-07T23:59:59Z',
      created_at: '2024-02-21T10:35:00Z',
      isOverdue: false
    },
    {
      id: 'inv-002',
      order_id: 'ord-550e8400-e29b-41d4-a716-446655440001',
      invoice_number: 'INV-2024-002',
      quotation_id: 'q-002',
      subtotal: 25000,
      labor_cost: 3000,
      overhead_cost: 2000,
      tax_amount: 1450,
      grand_total: 31450,
      paid_amount: 31450,
      outstanding: 0,
      payment_status: 'paid',
      due_date: '2024-03-05T23:59:59Z',
      created_at: '2024-02-18T14:25:00Z',
      isOverdue: false
    }
  ],

  // Sample Payments
  payments: [
    {
      id: 'pay-001',
      invoice_id: 'inv-001',
      invoice_number: 'INV-2024-001',
      amount: 5000,
      payment_method: 'upi',
      transaction_id: 'TXN-UPI-123456',
      payment_date: '2024-02-22T11:00:00Z',
      created_by: 'admin-001'
    },
    {
      id: 'pay-002',
      invoice_id: 'inv-002',
      invoice_number: 'INV-2024-002',
      amount: 31450,
      payment_method: 'bank_transfer',
      transaction_id: 'TXN-BANK-789012',
      payment_date: '2024-02-19T15:30:00Z',
      created_by: 'admin-001'
    }
  ],

  // Sample Revenue Report
  revenueReport: {
    period: {
      from: '2024-01-01',
      to: '2024-12-31'
    },
    totalRevenue: 52737.50,
    totalPaid: 36450,
    totalOutstanding: 16287.50,
    byPaymentMethod: {
      upi: 5000,
      bank_transfer: 31450
    },
    byStatus: {
      paid: 2,
      partial: 1,
      overdue: 0
    },
    quotations: {
      total: 3,
      accepted: 1,
      pending: 1,
      expired: 1
    }
  }
};

function printSection(title, data) {
  console.log(`\n📋 ${title}`);
  console.log('─'.repeat(60));
  console.log(JSON.stringify(data, null, 2));
}

// Demo 1: Health Check
console.log('\n🌐 Demo 1: Public Endpoints (No Auth Required)');
printSection('GET /health', DEMO_DATA.health);
printSection('GET /api-info', DEMO_DATA.apiInfo);

// Demo 2: Quotations
console.log('\n💰 Demo 2: Quotation Endpoints');
printSection('GET /billing/quotations (Admin only)', {
  success: true,
  data: DEMO_DATA.quotations,
  pagination: {
    total: 3,
    page: 1,
    limit: 20,
    totalPages: 1
  }
});

printSection('GET /billing/quotations/:id', {
  success: true,
  data: DEMO_DATA.quotations[0]
});

printSection('POST /billing/quotations (Create new)', {
  success: true,
  data: {
    ...DEMO_DATA.quotations[0],
    id: 'q-new-' + Date.now(),
    quotation_number: 'QT-2024-004',
    created_at: new Date().toISOString()
  },
  message: 'Quotation created with PDF'
});

// Demo 3: Invoices
console.log('\n📊 Demo 3: Invoice Endpoints');
printSection('POST /billing/invoices (Create from quotation)', {
  success: true,
  data: {
    ...DEMO_DATA.invoices[0],
    id: 'inv-new-' + Date.now(),
    invoice_number: 'INV-2024-003',
    created_at: new Date().toISOString()
  }
});

printSection('GET /billing/invoices/:id', {
  success: true,
  data: DEMO_DATA.invoices[0]
});

// Demo 4: Payments
console.log('\n💳 Demo 4: Payment Endpoints');
printSection('POST /billing/payments (Record payment)', {
  success: true,
  data: {
    id: 'pay-new-' + Date.now(),
    invoice_id: 'inv-001',
    amount: 3000,
    payment_method: 'cash',
    payment_date: new Date().toISOString()
  },
  invoice: {
    ...DEMO_DATA.invoices[0],
    paid_amount: 8000,
    outstanding: 5125,
    payment_status: 'partial'
  }
});

printSection('GET /billing/payments?invoiceId=inv-001', {
  success: true,
  data: [DEMO_DATA.payments[0]]
});

// Demo 5: Reports
console.log('\n📈 Demo 5: Report Endpoints');
printSection('GET /billing/reports/revenue', {
  success: true,
  data: DEMO_DATA.revenueReport
});

// Demo 6: Error Responses
console.log('\n⚠️  Demo 6: Error Responses');
printSection('401 Unauthorized (No token)', {
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message: 'No token provided',
    details: null
  }
});

printSection('403 Forbidden (Insufficient permissions)', {
  success: false,
  error: {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    details: null
  }
});

printSection('404 Not Found', {
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Quotation not found',
    details: null
  }
});

printSection('422 Validation Error', {
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [
      { field: 'orderId', message: 'Order ID must be a valid UUID' }
    ]
  }
});

printSection('500 Internal Error', {
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Database connection failed',
    details: null
  }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('📝 API ENDPOINT SUMMARY');
console.log('='.repeat(70));
console.log(`
🔓 PUBLIC ENDPOINTS (No Authentication):
   • GET  /health          - Health check
   • GET  /api-info        - API information

🔐 PROTECTED ENDPOINTS (Authentication Required):

📄 QUOTATIONS:
   • GET    /billing/quotations              - List all (Admin)
   • POST   /billing/quotations              - Create new
   • GET    /billing/quotations/:id          - Get by ID
   • GET    /billing/quotations/order/:orderId - Get by Order ID
   • GET    /billing/quotations/validate/:orderId - Validate

📊 INVOICES:
   • POST   /billing/invoices                - Create from quotation
   • GET    /billing/invoices/:id            - Get by ID
   • GET    /billing/invoices/order/:orderId - Get by Order ID
   • POST   /billing/invoices/mark-overdue   - Mark overdue (Admin)

💳 PAYMENTS:
   • POST   /billing/payments                - Record payment (Admin)
   • GET    /billing/payments                - List all (Admin)
   • GET    /billing/payments/invoice/:id    - Get by Invoice
   • POST   /billing/payments/refund         - Record refund (Admin)

📈 REPORTS:
   • GET    /billing/reports/revenue         - Revenue report (Admin)
`);

console.log('='.repeat(70));
console.log('✅ Demo Complete! Run the actual API with database for full functionality.');
console.log('   Frontend: http://localhost:3000/');
console.log('   API Base: http://localhost:3000/billing');
console.log('='.repeat(70));
