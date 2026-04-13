const request = require('supertest');
const app = require('../../app');

// Mock a valid token for auth middleware
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ id: 'a0000000-0000-0000-0000-000000000001', role: 'admin' })
}));

const billingRepository = require('../../modules/billing/repository');
const orderRepository = require('../../modules/orders/repository');
const menuRepository = require('../../modules/menu/repository');
const stockRepository = require('../../modules/stock/repository');

jest.mock('../../modules/billing/repository');
jest.mock('../../modules/orders/repository');
jest.mock('../../modules/menu/repository');
jest.mock('../../modules/stock/repository');

// ─────────────────────────────────────────────────
// UUIDs
// ─────────────────────────────────────────────────
const UUID = {
  ORDER:    'b0000000-0000-0000-0000-000000000001',
  CUSTOMER: 'c0000000-0000-0000-0000-000000000001',
  MENU_1:   'd0000000-0000-0000-0000-000000000001',
  ITEM_1:   'e0000000-0000-0000-0000-000000000001',
  ING_1:    'f0000000-0000-0000-0000-000000000001',
  QUOT:     'a1000000-0000-0000-0000-000000000001',
  INVOICE:  'a2000000-0000-0000-0000-000000000001',
  PAYMENT:  'a3000000-0000-0000-0000-000000000001',
  USER:     'a0000000-0000-0000-0000-000000000001'
};

// ─────────────────────────────────────────────────
// Shared mock data factories
// ─────────────────────────────────────────────────
const makeOrder = (overrides = {}) => ({
  id: UUID.ORDER,
  customer_id: UUID.CUSTOMER,
  event_date: '2026-05-01',
  event_type: 'Wedding',
  guest_count: 100,
  status: 'confirmed',
  total_amount: 63250,
  created_at: new Date(),
  ...overrides
});

const makeOrderItems = () => [
  {
    id: UUID.ITEM_1,
    menu_item_id: UUID.MENU_1,
    quantity: 10,
    unit_price: 500,
    name: 'Biryani'
  }
];

const makeRecipe = () => [
  {
    ingredient_id: UUID.ING_1,
    quantity_per_base_unit: 2,
    wastage_factor: 1.1,
    current_price_per_unit: 80
  }
];

const makeQuotation = (overrides = {}) => ({
  id: UUID.QUOT,
  order_id: UUID.ORDER,
  quotation_number: 'QUOT-100001',
  subtotal: 5000,
  labor_cost: 50000,
  overhead_cost: 5500,
  discount: 0,
  tax_amount: 2750,
  grand_total: 63250,
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
  ...overrides
});

const makeInvoice = (overrides = {}) => ({
  id: UUID.INVOICE,
  order_id: UUID.ORDER,
  invoice_number: 'INV-100001',
  invoice_date: new Date(),
  due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  total_amount: 63250,
  paid_amount: 0,
  payment_status: 'pending',
  created_at: new Date(),
  ...overrides
});

const makePayment = (overrides = {}) => ({
  id: UUID.PAYMENT,
  invoice_id: UUID.INVOICE,
  amount: 30000,
  payment_method: 'bank_transfer',
  transaction_id: 'TXN-001',
  payment_date: new Date(),
  created_at: new Date(),
  ...overrides
});

// ─────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────
describe('Billing Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════
  // QUOTATION CREATION
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/billing/quotations — Create Quotation', () => {
    it('should create a quotation with correct cost breakdown', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeOrder({ status: 'draft' }));
      orderRepository.getOrderItems.mockResolvedValue(makeOrderItems());
      menuRepository.getRecipe.mockResolvedValue(makeRecipe());

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());

      const response = await request(app)
        .post('/api/v1/billing/quotations')
        .set('Authorization', 'Bearer fake_token')
        .send({
          order_id: UUID.ORDER,
          labor_cost_per_guest: 500,
          overhead_percentage: 10,
          tax_percentage: 5
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quotation_number).toBeDefined();
      expect(response.body.data.breakdown).toBeDefined();
      expect(response.body.data.breakdown.ingredient_cost).toBeGreaterThan(0);
      expect(response.body.data.breakdown.labor_cost).toBeGreaterThan(0);
    });

    it('should reject duplicate quotation for the same order', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeOrder({ status: 'draft' }));
      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());

      const response = await request(app)
        .post('/api/v1/billing/quotations')
        .set('Authorization', 'Bearer fake_token')
        .send({
          order_id: UUID.ORDER,
          labor_cost_per_guest: 500
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 when order does not exist', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/billing/quotations')
        .set('Authorization', 'Bearer fake_token')
        .send({ order_id: UUID.ORDER });

      expect(response.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════
  // INVOICE CREATION
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/billing/invoices — Create Invoice', () => {
    it('should create an invoice linked to a quotation', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeOrder());
      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());
      billingRepository.createInvoice.mockResolvedValue(makeInvoice());

      const response = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', 'Bearer fake_token')
        .send({
          order_id: UUID.ORDER,
          due_date: '2026-06-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invoice_number).toBeDefined();
      expect(response.body.data.payment_status).toBe('pending');
      expect(response.body.data.total_amount).toBe(63250);
    });

    it('should auto-create quotation if none exists', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeOrder({ status: 'draft' }));
      orderRepository.getOrderItems.mockResolvedValue(makeOrderItems());
      menuRepository.getRecipe.mockResolvedValue(makeRecipe());

      // createInvoice calls findQuotationByOrderId 3 times:
      // 1st: in createInvoice itself → null (triggers auto-create)
      // 2nd: in createQuotation duplicate check → null (allows creation)
      // 3rd: in createInvoice after creation → returns quotation data
      billingRepository.findQuotationByOrderId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeQuotation());
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());
      billingRepository.createInvoice.mockResolvedValue(makeInvoice());

      const response = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', 'Bearer fake_token')
        .send({ order_id: UUID.ORDER });

      expect(response.status).toBe(201);
      expect(billingRepository.createQuotation).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // PAYMENT RECORDING & STATUS TRANSITIONS
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/billing/payments — Record Payment', () => {
    it('should record a partial payment and update invoice to partial status', async () => {
      const invoice = makeInvoice({ total_amount: 63250, paid_amount: 0 });
      billingRepository.findInvoiceById.mockResolvedValue(invoice);
      billingRepository.createPayment.mockResolvedValue(makePayment({ amount: 30000 }));
      billingRepository.getTotalPaidAmount.mockResolvedValue(0);
      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...invoice,
        paid_amount: 30000,
        payment_status: 'partial'
      });

      const response = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 30000,
          payment_method: 'bank_transfer',
          transaction_id: 'TXN-001'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invoice_status).toBe('partial');
      expect(response.body.data.total_paid).toBe(30000);
      expect(response.body.data.pending_amount).toBe(33250);
    });

    it('should mark invoice as fully paid when remaining balance is covered', async () => {
      const invoice = makeInvoice({ total_amount: 63250, paid_amount: 30000, payment_status: 'partial' });
      billingRepository.findInvoiceById.mockResolvedValue(invoice);
      billingRepository.createPayment.mockResolvedValue(makePayment({ amount: 33250 }));
      billingRepository.getTotalPaidAmount.mockResolvedValue(30000);
      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...invoice,
        paid_amount: 63250,
        payment_status: 'paid'
      });

      const response = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 33250,
          payment_method: 'upi'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invoice_status).toBe('paid');
      expect(response.body.data.pending_amount).toBe(0);
    });

    it('should reject payment on a fully paid invoice', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(
        makeInvoice({ paid_amount: 63250, payment_status: 'paid' })
      );

      const response = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 5000,
          payment_method: 'cash'
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 when invoice does not exist', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 1000,
          payment_method: 'cash'
        });

      expect(response.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════
  // REFUND PROCESSING
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/billing/payments/refund — Process Refund', () => {
    it('should process a valid refund and update invoice', async () => {
      const invoice = makeInvoice({ paid_amount: 63250, payment_status: 'paid', total_amount: 63250 });
      billingRepository.findInvoiceById.mockResolvedValue(invoice);
      billingRepository.createPayment.mockResolvedValue(
        makePayment({ amount: -20000, transaction_id: 'REFUND-001' })
      );
      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...invoice,
        paid_amount: 43250,
        payment_status: 'partial'
      });

      const response = await request(app)
        .post('/api/v1/billing/payments/refund')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 20000,
          reason: 'Partial service not delivered'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.refund_amount).toBe(20000);
      expect(response.body.data.invoice_status).toBe('partial');
    });

    it('should reject refund exceeding paid amount', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(
        makeInvoice({ paid_amount: 10000, payment_status: 'partial', total_amount: 63250 })
      );

      const response = await request(app)
        .post('/api/v1/billing/payments/refund')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 50000,
          reason: 'Customer requested full refund'
        });

      expect(response.status).toBe(400);
    });

    it('should reject refund on an invoice with no payments', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(
        makeInvoice({ paid_amount: 0, payment_status: 'pending' })
      );

      const response = await request(app)
        .post('/api/v1/billing/payments/refund')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 5000,
          reason: 'Erroneous charge'
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 when trying to refund a non-existent invoice', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/billing/payments/refund')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 1000,
          reason: 'Invoice not found test'
        });

      expect(response.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════
  describe('GET /api/v1/billing/quotations/:id — Get Quotation', () => {
    it('should return quotation details', async () => {
      billingRepository.findQuotationById.mockResolvedValue(makeQuotation());

      const response = await request(app)
        .get(`/api/v1/billing/quotations/${UUID.QUOT}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(200);
      expect(response.body.data.quotation_number).toBe('QUOT-100001');
      expect(response.body.data.grand_total).toBe(63250);
    });

    it('should return 404 for non-existent quotation', async () => {
      billingRepository.findQuotationById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/billing/quotations/${UUID.QUOT}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/billing/invoices/:id — Get Invoice with Payments', () => {
    it('should return invoice with payment history', async () => {
      billingRepository.findInvoiceById.mockResolvedValue(
        makeInvoice({ paid_amount: 30000, payment_status: 'partial' })
      );
      billingRepository.getPayments.mockResolvedValue([
        makePayment({ amount: 30000 })
      ]);

      const response = await request(app)
        .get(`/api/v1/billing/invoices/${UUID.INVOICE}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(200);
      expect(response.body.data.payments).toHaveLength(1);
      expect(response.body.data.pending_amount).toBe(33250);
    });
  });
});
