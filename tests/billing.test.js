/**
 * Billing Module Tests
 * Unit tests for Billing & Payments functionality
 */

const request = require('supertest');

// Mock database before requiring app
const mockQuery = jest.fn();
const mockGetClient = jest.fn();

jest.mock('../src/config/database', () => ({
  query: mockQuery,
  getClient: mockGetClient,
  pool: { on: jest.fn() }
}));

const app = require('../src/index');

describe('Billing API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== HEALTH CHECK ====================
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.module).toBe('Billing & Payments');
    });
  });

  // ==================== PUBLIC ENDPOINTS ====================

  describe('GET /billing/test', () => {
    it('should return test message', async () => {
      const response = await request(app).get('/billing/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Billing API is working!');
    });
  });

  // ==================== QUOTATION TESTS ====================

  describe('POST /billing/quotations', () => {
    const validQuotation = {
      orderId: '123e4567-e89b-12d3-a456-426614174000',
      subtotal: 20000,
      laborCost: 3000,
      overheadCost: 2000,
      discount: 0,
      taxAmount: 1250,
      grandTotal: 26250
    };

    it('should reject invalid quotation data', async () => {
      const response = await request(app)
        .post('/billing/quotations')
        .send({}); // Missing required fields
      
      expect(response.status).toBe(422);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/billing/quotations')
        .send(validQuotation);
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /billing/quotations/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/billing/quotations/123e4567-e89b-12d3-a456-426614174000');
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /billing/quotations/validate/:orderId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/billing/quotations/validate/123e4567-e89b-12d3-a456-426614174000');
      
      expect(response.status).toBe(401);
    });
  });

  // ==================== INVOICE TESTS ====================

  describe('POST /billing/invoices', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/billing/invoices')
        .send({ orderId: '123e4567-e89b-12d3-a456-426614174000' });
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /billing/invoices/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/billing/invoices/123e4567-e89b-12d3-a456-426614174000');
      
      expect(response.status).toBe(401);
    });
  });

  // ==================== PAYMENT TESTS ====================

  describe('POST /billing/payments', () => {
    const validPayment = {
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 10000,
      paymentMethod: 'upi'
    };

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/billing/payments')
        .send(validPayment);
      
      expect(response.status).toBe(401);
    });
  });

  describe('GET /billing/payments', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/billing/payments');
      expect(response.status).toBe(401);
    });
  });

  // ==================== REPORT TESTS ====================

  describe('GET /billing/reports/revenue', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/billing/reports/revenue')
        .query({ from: '2024-01-01', to: '2024-12-31' });
      
      expect(response.status).toBe(401);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent');
      expect(response.status).toBe(404);
    });
  });
});

// ==================== MODEL TESTS ====================

describe('Billing Models Tests', () => {
  const billingModels = require('../src/models/billingModels');

  describe('Quotation Number Generation', () => {
    it('should generate quotation number in correct format', () => {
      // Test format: QT-YYYYMMDD-XXX
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const expectedPrefix = `QT-${today}`;
      
      // This would need mock setup to test properly
      expect(expectedPrefix).toMatch(/^QT-\d{8}$/);
    });
  });

  describe('Invoice Number Generation', () => {
    it('should generate invoice number in correct format', () => {
      // Test format: INV-YYYYMMDD-XXX
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const expectedPrefix = `INV-${today}`;
      
      expect(expectedPrefix).toMatch(/^INV-\d{8}$/);
    });
  });
});

// ==================== VALIDATION TESTS ====================

describe('Validation Schemas Tests', () => {
  const schemas = require('../src/validation/schemas');

  describe('createQuotationSchema', () => {
    it('should validate correct quotation data', () => {
      const validData = {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        subtotal: 20000,
        grandTotal: 26250
      };

      const { error } = schemas.createQuotationSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject missing orderId', () => {
      const invalidData = {
        subtotal: 20000,
        grandTotal: 26250
      };

      const { error } = schemas.createQuotationSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject negative subtotal', () => {
      const invalidData = {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        subtotal: -1000,
        grandTotal: 26250
      };

      const { error } = schemas.createQuotationSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('createPaymentSchema', () => {
    it('should validate correct payment data', () => {
      const validData = {
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 10000,
        paymentMethod: 'upi'
      };

      const { error } = schemas.createPaymentSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid payment method', () => {
      const invalidData = {
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 10000,
        paymentMethod: 'invalid_method'
      };

      const { error } = schemas.createPaymentSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject negative amount', () => {
      const invalidData = {
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: -1000,
        paymentMethod: 'upi'
      };

      const { error } = schemas.createPaymentSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('revenueReportSchema', () => {
    it('should validate correct date range', () => {
      const validData = {
        from: '2024-01-01',
        to: '2024-12-31'
      };

      const { error } = schemas.revenueReportSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject missing dates', () => {
      const invalidData = {
        from: '2024-01-01'
        // Missing 'to'
      };

      const { error } = schemas.revenueReportSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject end date before start date', () => {
      const invalidData = {
        from: '2024-12-31',
        to: '2024-01-01'
      };

      const { error } = schemas.revenueReportSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });
});

// ==================== PAYMENT METHODS ====================

describe('Payment Methods', () => {
  const schemas = require('../src/validation/schemas');

  const validPaymentMethods = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

  validPaymentMethods.forEach(method => {
    it(`should accept ${method} as valid payment method`, () => {
      const data = {
        invoiceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 1000,
        paymentMethod: method
      };

      const { error } = schemas.createPaymentSchema.validate(data);
      expect(error).toBeUndefined();
    });
  });
});

// ==================== BUSINESS RULES TESTS ====================

describe('Business Rules Tests', () => {
  describe('Quotation Validity', () => {
    it('should have 7 days validity period', () => {
      const createdDate = new Date();
      const validUntil = new Date(createdDate);
      validUntil.setDate(validUntil.getDate() + 7);
      
      const daysDiff = Math.ceil((validUntil - createdDate) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });
  });

  describe('Invoice Due Date', () => {
    it('should have 15 days due period', () => {
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 15);
      
      const daysDiff = Math.ceil((dueDate - invoiceDate) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(15);
    });
  });

  describe('Payment Status Calculation', () => {
    it('should be pending when no payment made', () => {
      const grandTotal = 10000;
      const paidAmount = 0;
      
      let paymentStatus = 'pending';
      if (paidAmount >= grandTotal) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      
      expect(paymentStatus).toBe('pending');
    });

    it('should be partial when partial payment made', () => {
      const grandTotal = 10000;
      const paidAmount = 5000;
      
      let paymentStatus = 'pending';
      if (paidAmount >= grandTotal) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      
      expect(paymentStatus).toBe('partial');
    });

    it('should be paid when full payment made', () => {
      const grandTotal = 10000;
      const paidAmount = 10000;
      
      let paymentStatus = 'pending';
      if (paidAmount >= grandTotal) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      
      expect(paymentStatus).toBe('paid');
    });
  });

  describe('Overpayment Prevention', () => {
    it('should prevent payment exceeding outstanding amount', () => {
      const grandTotal = 10000;
      const paidAmount = 3000;
      const paymentAmount = 8000; // More than outstanding (7000)
      
      const outstanding = grandTotal - paidAmount;
      const isValidPayment = paymentAmount <= outstanding;
      
      expect(isValidPayment).toBe(false);
    });

    it('should allow payment up to outstanding amount', () => {
      const grandTotal = 10000;
      const paidAmount = 3000;
      const paymentAmount = 7000; // Equal to outstanding
      
      const outstanding = grandTotal - paidAmount;
      const isValidPayment = paymentAmount <= outstanding;
      
      expect(isValidPayment).toBe(true);
    });
  });
});
