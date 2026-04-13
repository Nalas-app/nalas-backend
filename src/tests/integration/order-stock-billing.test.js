const request = require('supertest');
const app = require('../../app');

// Mock a valid token for auth middleware
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ id: 'a0000000-0000-0000-0000-000000000001', role: 'admin' })
}));

const orderRepository = require('../../modules/orders/repository');
const menuRepository = require('../../modules/menu/repository');
const billingRepository = require('../../modules/billing/repository');
const stockRepository = require('../../modules/stock/repository');
const stockService = require('../../modules/stock/service');
const { pool } = require('../../config/database');
const axios = require('axios');

jest.mock('../../modules/orders/repository');
jest.mock('../../modules/menu/repository');
jest.mock('../../modules/billing/repository');
jest.mock('../../modules/stock/repository');
jest.mock('../../modules/stock/service');

// ─────────────────────────────────────────────────
// UUIDs
// ─────────────────────────────────────────────────
const UUID = {
  ORDER:       'b0000000-0000-0000-0000-000000000001',
  CUSTOMER:    'c0000000-0000-0000-0000-000000000001',
  MENU_BIR:    'd0000000-0000-0000-0000-000000000001',
  MENU_PAN:    'd0000000-0000-0000-0000-000000000002',
  MENU_DES:    'd0000000-0000-0000-0000-000000000003',
  ING_RICE:    'f0000000-0000-0000-0000-000000000001',
  ING_CHICKEN: 'f0000000-0000-0000-0000-000000000002',
  ING_SPICES:  'f0000000-0000-0000-0000-000000000003',
  ING_PANEER:  'f0000000-0000-0000-0000-000000000004',
  ING_MILK:    'f0000000-0000-0000-0000-000000000005',
  ING_SUGAR:   'f0000000-0000-0000-0000-000000000006',
  QUOT:        'a1000000-0000-0000-0000-000000000001',
  INVOICE:     'a2000000-0000-0000-0000-000000000001',
  USER:        'a0000000-0000-0000-0000-000000000001'
};

// Future date for validation compliance
const FUTURE_DATE = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// ─────────────────────────────────────────────────
// Shared data factories
// ─────────────────────────────────────────────────
const makeDraftOrder = (id = UUID.ORDER) => ({
  id,
  customer_id: UUID.CUSTOMER,
  event_date: FUTURE_DATE,
  event_time: '19:00',
  event_type: 'Corporate',
  guest_count: 200,
  venue_address: '456 Corporate Park, Chennai',
  status: 'draft',
  total_amount: 0,
  created_at: new Date(),
  updated_at: new Date()
});

const makeOrderItems = () => [
  { id: 'item-1', menu_item_id: UUID.MENU_BIR, quantity: 20, unit_price: 500, name: 'Chicken Biryani' },
  { id: 'item-2', menu_item_id: UUID.MENU_PAN, quantity: 15, unit_price: 400, name: 'Paneer Tikka' },
  { id: 'item-3', menu_item_id: UUID.MENU_DES, quantity: 10, unit_price: 250, name: 'Gulab Jamun' }
];

const makeRecipes = () => ({
  [UUID.MENU_BIR]: [
    { ingredient_id: UUID.ING_RICE, ingredient_name: 'Basmati Rice', unit: 'kg', quantity_per_base_unit: 0.5, wastage_factor: 1.1, current_price_per_unit: 120 },
    { ingredient_id: UUID.ING_CHICKEN, ingredient_name: 'Chicken', unit: 'kg', quantity_per_base_unit: 0.3, wastage_factor: 1.05, current_price_per_unit: 250 },
    { ingredient_id: UUID.ING_SPICES, ingredient_name: 'Biryani Spice Mix', unit: 'kg', quantity_per_base_unit: 0.02, wastage_factor: 1.0, current_price_per_unit: 800 }
  ],
  [UUID.MENU_PAN]: [
    { ingredient_id: UUID.ING_PANEER, ingredient_name: 'Paneer', unit: 'kg', quantity_per_base_unit: 0.25, wastage_factor: 1.1, current_price_per_unit: 350 },
    { ingredient_id: UUID.ING_SPICES, ingredient_name: 'Tikka Spice Mix', unit: 'kg', quantity_per_base_unit: 0.015, wastage_factor: 1.0, current_price_per_unit: 800 }
  ],
  [UUID.MENU_DES]: [
    { ingredient_id: UUID.ING_MILK, ingredient_name: 'Milk', unit: 'L', quantity_per_base_unit: 0.2, wastage_factor: 1.05, current_price_per_unit: 60 },
    { ingredient_id: UUID.ING_SUGAR, ingredient_name: 'Sugar', unit: 'kg', quantity_per_base_unit: 0.1, wastage_factor: 1.0, current_price_per_unit: 45 }
  ]
});

const makeQuotation = (overrides = {}) => ({
  id: UUID.QUOT,
  order_id: UUID.ORDER,
  quotation_number: 'QUOT-E2E-001',
  subtotal: 12000,
  labor_cost: 100000,
  overhead_cost: 11200,
  discount: 0,
  tax_amount: 6160,
  grand_total: 129360,
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
  ...overrides
});

const makeInvoice = (overrides = {}) => ({
  id: UUID.INVOICE,
  order_id: UUID.ORDER,
  invoice_number: 'INV-E2E-001',
  invoice_date: new Date(),
  due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  total_amount: 129360,
  paid_amount: 0,
  payment_status: 'pending',
  created_at: new Date(),
  ...overrides
});

// Mock for the database transaction client
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

// ─────────────────────────────────────────────────
// FULL E2E LIFECYCLE TESTS
// ─────────────────────────────────────────────────
describe('Order → Stock → Billing: Full E2E Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
    axios.post.mockRejectedValue(new Error('ML service unavailable')); // default: ML off
  });

  // ═══════════════════════════════════════════════
  // TEST 1: COMPLETE HAPPY PATH LIFECYCLE
  // draft → quoted → confirmed → preparing → completed
  // ═══════════════════════════════════════════════
  describe('Happy Path: Complete Order Lifecycle', () => {
    it('should take an order from draft → quoted → confirmed → preparing → completed', async () => {
      const recipes = makeRecipes();
      const orderItems = makeOrderItems();

      // ───── STEP 1: Create Order ─────
      const draftOrder = makeDraftOrder();
      orderRepository.createOrder.mockResolvedValue(draftOrder);
      orderRepository.createOrderItem.mockImplementation((orderId, menuItemId, qty, price) =>
        Promise.resolve({ id: `item-${menuItemId}`, order_id: orderId, menu_item_id: menuItemId, quantity: qty, unit_price: price, total_price: qty * price })
      );
      orderRepository.updateTotalAmount.mockResolvedValue({});
      orderRepository.logStatusChange.mockResolvedValue({});

      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', 'Bearer fake_token')
        .send({
          event_date: FUTURE_DATE,
          event_time: '19:00',
          event_type: 'Corporate',
          guest_count: 200,
          venue_address: '456 Corporate Park, Chennai',
          order_items: [
            { menu_item_id: UUID.MENU_BIR, quantity: 20 },
            { menu_item_id: UUID.MENU_PAN, quantity: 15 },
            { menu_item_id: UUID.MENU_DES, quantity: 10 }
          ]
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.status).toBe('draft');

      // ───── STEP 2: Generate Quotation ─────
      orderRepository.findOrderById.mockResolvedValue(draftOrder);
      orderRepository.getOrderItems.mockResolvedValue(orderItems);

      menuRepository.getRecipe.mockImplementation((menuItemId) => {
        return Promise.resolve(recipes[menuItemId] || []);
      });

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());

      const quotedOrder = { ...draftOrder, status: 'quoted' };
      orderRepository.updateOrderStatus.mockResolvedValue(quotedOrder);

      const quotationRes = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(quotationRes.status).toBe(200);
      expect(quotationRes.body.data.quotation.quotation_number).toBe('QUOT-E2E-001');
      expect(quotationRes.body.data.status).toBe('quoted');
      expect(quotationRes.body.data.item_breakdown).toHaveLength(3);

      // ───── STEP 3: Confirm Order (reserves stock + creates invoice) ─────
      jest.clearAllMocks();
      pool.connect.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [quotedOrder] });
        }
        return Promise.resolve({ rows: [] });
      });

      orderRepository.getOrderItems.mockResolvedValue(orderItems);

      menuRepository.getRecipe.mockImplementation((menuItemId) => {
        return Promise.resolve(recipes[menuItemId] || []);
      });

      stockService.reserveStock.mockResolvedValue({
        ingredient_id: UUID.ING_RICE,
        ingredient_name: 'Basmati Rice',
        reserved_quantity: 50,
        available_quantity: 500
      });

      orderRepository.saveStockReservation.mockResolvedValue({});

      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());
      orderRepository.findOrderById.mockResolvedValue(quotedOrder);
      billingRepository.createInvoice.mockResolvedValue(makeInvoice());

      const confirmedOrder = { ...draftOrder, status: 'confirmed' };
      orderRepository.updateOrderStatus.mockResolvedValue(confirmedOrder);
      orderRepository.logStatusChange.mockResolvedValue({});

      const confirmRes = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('confirmed');
      expect(confirmRes.body.data.invoice).toBeDefined();
      expect(confirmRes.body.data.invoice.invoice_number).toBe('INV-E2E-001');
      expect(confirmRes.body.data.stock_reservations.length).toBeGreaterThan(0);

      // Verify transaction lifecycle
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(stockService.reserveStock).toHaveBeenCalled();

      // ───── STEP 4: Move to Preparing ─────
      jest.clearAllMocks();
      orderRepository.findOrderById.mockResolvedValue(confirmedOrder);
      const preparingOrder = { ...draftOrder, status: 'preparing' };
      orderRepository.updateOrderStatus.mockResolvedValue(preparingOrder);
      orderRepository.logStatusChange.mockResolvedValue({});

      const preparingRes = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'preparing' });

      expect(preparingRes.status).toBe(200);
      expect(preparingRes.body.data.status).toBe('preparing');
      expect(preparingRes.body.data.previous_status).toBe('confirmed');

      // ───── STEP 5: Complete ─────
      jest.clearAllMocks();
      orderRepository.findOrderById.mockResolvedValue(preparingOrder);
      const completedOrder = { ...draftOrder, status: 'completed' };
      orderRepository.updateOrderStatus.mockResolvedValue(completedOrder);
      orderRepository.logStatusChange.mockResolvedValue({});

      const completeRes = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'completed' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
      expect(completeRes.body.data.previous_status).toBe('preparing');
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 2: MULTI-INGREDIENT STOCK AGGREGATION
  // ═══════════════════════════════════════════════
  describe('Happy Path: Multi-ingredient stock aggregation', () => {
    it('should correctly aggregate quantities when multiple menu items share the same ingredient', async () => {
      const orderItems = makeOrderItems();
      const recipes = makeRecipes();

      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [{ ...makeDraftOrder(), status: 'quoted' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      orderRepository.getOrderItems.mockResolvedValue(orderItems);
      menuRepository.getRecipe.mockImplementation((menuItemId) => {
        return Promise.resolve(recipes[menuItemId] || []);
      });

      stockService.reserveStock.mockResolvedValue({
        ingredient_id: 'ing-1',
        ingredient_name: 'Ingredient',
        reserved_quantity: 50,
        available_quantity: 500
      });
      orderRepository.saveStockReservation.mockResolvedValue({});
      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());
      orderRepository.findOrderById.mockResolvedValue({ ...makeDraftOrder(), status: 'quoted' });
      billingRepository.createInvoice.mockResolvedValue(makeInvoice());
      orderRepository.updateOrderStatus.mockResolvedValue({ ...makeDraftOrder(), status: 'confirmed' });
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);

      // 'ING_SPICES' is used in both biryani (0.02 * 20 * 1.0 = 0.4) and paneer (0.015 * 15 * 1.0 = 0.225)
      // They should be aggregated into a single reserveStock call with quantity 0.625
      const reserveCalls = stockService.reserveStock.mock.calls;
      const spiceReservation = reserveCalls.find(call => call[0] === UUID.ING_SPICES);
      if (spiceReservation) {
        expect(spiceReservation[1]).toBeCloseTo(0.625, 2);
      }

      // Unique ingredients across all recipes: rice, chicken, spices, paneer, milk, sugar = 6
      const uniqueIngredients = new Set();
      for (const recipe of Object.values(recipes)) {
        recipe.forEach(r => uniqueIngredients.add(r.ingredient_id));
      }
      expect(orderRepository.saveStockReservation).toHaveBeenCalledTimes(uniqueIngredients.size);
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 3: CANCELLATION → STOCK RELEASE
  // ═══════════════════════════════════════════════
  describe('Rollback: Confirmed order cancellation with stock release', () => {
    it('should release all reserved stock and clean up reservations on cancellation', async () => {
      const confirmedOrder = { ...makeDraftOrder(), status: 'confirmed' };
      orderRepository.findOrderById.mockResolvedValue(confirmedOrder);

      orderRepository.getStockReservations.mockResolvedValue([
        { ingredient_id: UUID.ING_RICE, reserved_quantity: 11 },
        { ingredient_id: UUID.ING_CHICKEN, reserved_quantity: 6.3 },
        { ingredient_id: UUID.ING_SPICES, reserved_quantity: 0.625 },
        { ingredient_id: UUID.ING_PANEER, reserved_quantity: 4.125 },
        { ingredient_id: UUID.ING_MILK, reserved_quantity: 2.1 },
        { ingredient_id: UUID.ING_SUGAR, reserved_quantity: 1 }
      ]);

      stockService.releaseReservedStock.mockResolvedValue({
        available_quantity: 500,
        reserved_quantity: 0
      });
      orderRepository.deleteStockReservations.mockResolvedValue();

      const cancelledOrder = { ...makeDraftOrder(), status: 'cancelled' };
      orderRepository.updateOrderStatus.mockResolvedValue(cancelledOrder);
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');

      // All 6 ingredients should have been released
      expect(stockService.releaseReservedStock).toHaveBeenCalledTimes(6);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_RICE, 11);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_CHICKEN, 6.3);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_SPICES, 0.625);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_PANEER, 4.125);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_MILK, 2.1);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_SUGAR, 1);

      expect(orderRepository.deleteStockReservations).toHaveBeenCalledWith(UUID.ORDER);
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 4: PARTIAL STOCK RESERVATION FAILURE
  // ═══════════════════════════════════════════════
  describe('Rollback: Partial stock reservation failure (all-or-nothing)', () => {
    it('should rollback entire transaction if stock runs out mid-reservation', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [{ ...makeDraftOrder(), status: 'quoted' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderItems = makeOrderItems();
      orderRepository.getOrderItems.mockResolvedValue(orderItems);

      const recipes = makeRecipes();
      menuRepository.getRecipe.mockImplementation((menuItemId) => {
        return Promise.resolve(recipes[menuItemId] || []);
      });

      let reserveCallCount = 0;
      stockService.reserveStock.mockImplementation(() => {
        reserveCallCount++;
        if (reserveCallCount === 3) {
          return Promise.reject(new Error('Insufficient available stock for reservation'));
        }
        return Promise.resolve({ ingredient_id: 'ing-1', ingredient_name: 'Ingredient', reserved_quantity: 10, available_quantity: 100 });
      });

      orderRepository.saveStockReservation.mockResolvedValue({});
      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBeGreaterThanOrEqual(400);

      // Transaction must be rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();

      // Order should NOT be confirmed
      expect(orderRepository.updateOrderStatus).not.toHaveBeenCalled();

      // Invoice should NOT be created
      expect(billingRepository.createInvoice).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 5: NO QUOTATION FOUND
  // ═══════════════════════════════════════════════
  describe('Rollback: Confirmation without quotation', () => {
    it('should reject confirmation when no quotation exists', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [{ ...makeDraftOrder(), status: 'quoted' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(400);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

      expect(orderRepository.getOrderItems).not.toHaveBeenCalled();
      expect(stockService.reserveStock).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 6: ML PREDICTION FALLBACK CONSISTENCY
  // ═══════════════════════════════════════════════
  describe('ML Fallback: Quotation with mixed ML and recipe results', () => {
    it('should fall back to recipe-based costing per-item when ML fails for some items', async () => {
      const orderItems = makeOrderItems();
      const recipes = makeRecipes();

      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.getOrderItems.mockResolvedValue(orderItems);
      orderRepository.updateOrderStatus.mockResolvedValue({ ...makeDraftOrder(), status: 'quoted' });
      orderRepository.updateTotalAmount.mockResolvedValue({});
      orderRepository.logStatusChange.mockResolvedValue({});

      menuRepository.getRecipe.mockImplementation((menuItemId) => {
        return Promise.resolve(recipes[menuItemId] || []);
      });

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());

      // ML succeeds for first item, fails for the rest
      let mlCallCount = 0;
      axios.post.mockImplementation(() => {
        mlCallCount++;
        if (mlCallCount === 1) {
          return Promise.resolve({ data: { predicted_cost: 850 } });
        }
        return Promise.reject(new Error('ML timeout'));
      });

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);

      const breakdown = response.body.data.item_breakdown;
      expect(breakdown).toHaveLength(3);

      // First item used ML
      expect(breakdown[0].method).toBe('ML');
      // Remaining items fell back to recipe
      expect(breakdown[1].method).toBe('Recipe/Fallback');
      expect(breakdown[2].method).toBe('Recipe/Fallback');

      // Overall flag should be false since not all items used ML
      expect(response.body.data.is_ml_predicted).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 7: FULL PAYMENT LIFECYCLE AFTER CONFIRMATION
  // ═══════════════════════════════════════════════
  describe('Happy Path: Payment lifecycle (pending → partial → paid)', () => {
    it('should track payments through full lifecycle across billing module', async () => {
      // ───── Record first partial payment ─────
      const invoice = makeInvoice({ total_amount: 129360, paid_amount: 0, payment_status: 'pending' });
      billingRepository.findInvoiceById.mockResolvedValue(invoice);
      billingRepository.createPayment.mockResolvedValue({
        id: 'pay-1', invoice_id: UUID.INVOICE, amount: 50000,
        payment_method: 'bank_transfer', payment_date: new Date()
      });
      billingRepository.getTotalPaidAmount.mockResolvedValue(0);
      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...invoice, paid_amount: 50000, payment_status: 'partial'
      });

      const partialRes = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 50000,
          payment_method: 'bank_transfer'
        });

      expect(partialRes.status).toBe(201);
      expect(partialRes.body.data.invoice_status).toBe('partial');
      expect(partialRes.body.data.pending_amount).toBe(79360);

      // ───── Record second payment to complete ─────
      jest.clearAllMocks();
      const partialInvoice = makeInvoice({ total_amount: 129360, paid_amount: 50000, payment_status: 'partial' });
      billingRepository.findInvoiceById.mockResolvedValue(partialInvoice);
      billingRepository.createPayment.mockResolvedValue({
        id: 'pay-2', invoice_id: UUID.INVOICE, amount: 79360,
        payment_method: 'upi', payment_date: new Date()
      });
      billingRepository.getTotalPaidAmount.mockResolvedValue(50000);
      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...partialInvoice, paid_amount: 129360, payment_status: 'paid'
      });

      const paidRes = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 79360,
          payment_method: 'upi'
        });

      expect(paidRes.status).toBe(201);
      expect(paidRes.body.data.invoice_status).toBe('paid');
      expect(paidRes.body.data.pending_amount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════
  // TEST 8: REFUND AFTER CANCELLATION
  // ═══════════════════════════════════════════════
  describe('Rollback: Refund after order cancellation', () => {
    it('should process refund on a cancelled order with payments', async () => {
      const invoice = makeInvoice({
        total_amount: 129360,
        paid_amount: 50000,
        payment_status: 'partial'
      });
      billingRepository.findInvoiceById.mockResolvedValue(invoice);

      billingRepository.createPayment.mockResolvedValue({
        id: 'refund-1', invoice_id: UUID.INVOICE, amount: -50000,
        payment_method: 'bank_transfer', transaction_id: 'REFUND-001',
        payment_date: new Date()
      });

      billingRepository.updateInvoicePaidAmount.mockResolvedValue({
        ...invoice,
        paid_amount: 0,
        payment_status: 'pending'
      });

      const response = await request(app)
        .post('/api/v1/billing/payments/refund')
        .set('Authorization', 'Bearer fake_token')
        .send({
          invoice_id: UUID.INVOICE,
          amount: 50000,
          reason: 'Order cancelled by customer'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.refund_amount).toBe(50000);
      expect(response.body.data.remaining_paid).toBe(0);
    });
  });
});
