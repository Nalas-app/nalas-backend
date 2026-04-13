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
// UUIDs for test data
// ─────────────────────────────────────────────────
const UUID = {
  ORDER:    'b0000000-0000-0000-0000-000000000001',
  CUSTOMER: 'c0000000-0000-0000-0000-000000000001',
  MENU_1:   'd0000000-0000-0000-0000-000000000001',
  MENU_2:   'd0000000-0000-0000-0000-000000000002',
  ITEM_1:   'e0000000-0000-0000-0000-000000000001',
  ITEM_2:   'e0000000-0000-0000-0000-000000000002',
  ING_RICE: 'f0000000-0000-0000-0000-000000000001',
  ING_PANEER: 'f0000000-0000-0000-0000-000000000002',
  QUOT:     'a1000000-0000-0000-0000-000000000001',
  INVOICE:  'a2000000-0000-0000-0000-000000000001',
  USER:     'a0000000-0000-0000-0000-000000000001'
};

// Future date for validation compliance
const FUTURE_DATE = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// ─────────────────────────────────────────────────
// Shared mock data factories
// ─────────────────────────────────────────────────
const makeDraftOrder = (overrides = {}) => ({
  id: UUID.ORDER,
  customer_id: UUID.CUSTOMER,
  event_date: FUTURE_DATE,
  event_time: '18:00',
  event_type: 'Wedding',
  guest_count: 100,
  venue_address: '123 Main Street, Chennai',
  status: 'draft',
  total_amount: 0,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

const makeQuotedOrder = (overrides = {}) => makeDraftOrder({ status: 'quoted', ...overrides });
const makeConfirmedOrder = (overrides = {}) => makeDraftOrder({ status: 'confirmed', ...overrides });

const makeOrderItems = () => [
  { id: UUID.ITEM_1, menu_item_id: UUID.MENU_1, quantity: 10, unit_price: 500, name: 'Biryani' },
  { id: UUID.ITEM_2, menu_item_id: UUID.MENU_2, quantity: 5, unit_price: 300, name: 'Paneer Butter Masala' }
];

const makeRecipe = (ingredientId = UUID.ING_RICE, ingredientName = 'Rice') => [
  {
    ingredient_id: ingredientId,
    ingredient_name: ingredientName,
    unit: 'kg',
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

// Mock for the database transaction client
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

// ─────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────
describe('Orders Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  // ═══════════════════════════════════════════════
  // HAPPY PATH: QUOTATION GENERATION
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/orders/:id/quotation — Quotation Generation', () => {
    it('should generate a quotation for a draft order using recipe-based costing', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.getOrderItems.mockResolvedValue(makeOrderItems());
      orderRepository.updateOrderStatus.mockResolvedValue(makeQuotedOrder());
      orderRepository.updateTotalAmount.mockResolvedValue({});
      orderRepository.logStatusChange.mockResolvedValue({});

      menuRepository.getRecipe.mockResolvedValue(makeRecipe());

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());

      // Axios (ML) will fail → recipe fallback is used
      axios.post.mockRejectedValue(new Error('ML service unavailable'));

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quotation).toBeDefined();
      expect(response.body.data.quotation.quotation_number).toBe('QUOT-100001');
      // Order status should be updated to 'quoted'
      expect(orderRepository.updateOrderStatus).toHaveBeenCalledWith(UUID.ORDER, 'quoted');
    });

    it('should use ML cost prediction when ML service is available', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.getOrderItems.mockResolvedValue([makeOrderItems()[0]]);
      orderRepository.updateOrderStatus.mockResolvedValue(makeQuotedOrder());
      orderRepository.updateTotalAmount.mockResolvedValue({});
      orderRepository.logStatusChange.mockResolvedValue({});

      menuRepository.getRecipe.mockResolvedValue(makeRecipe());

      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue(makeQuotation());

      // ML service returns a valid prediction
      axios.post.mockResolvedValue({
        data: { predicted_cost: 750 }
      });

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.data.is_ml_predicted).toBe(true);
      expect(response.body.data.item_breakdown[0].method).toBe('ML');
    });

    it('should return 404 if order does not exist', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(404);
    });

    it('should reject quotation generation for non-draft orders', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeConfirmedOrder());

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(400);
    });

    it('should reject quotation generation when order has no items', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.getOrderItems.mockResolvedValue([]);

      axios.post.mockRejectedValue(new Error('ML unavailable'));

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/quotation`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════
  // HAPPY PATH: ORDER CONFIRMATION (Order → Stock → Billing)
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/orders/:id/confirm — Order Confirmation', () => {
    const setupConfirmationMocks = () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [makeQuotedOrder()] });
        }
        return Promise.resolve({ rows: [] });
      });

      orderRepository.findOrderById.mockResolvedValue(makeQuotedOrder());
      orderRepository.getOrderItems.mockResolvedValue(makeOrderItems());
      orderRepository.saveStockReservation.mockResolvedValue({});
      orderRepository.updateOrderStatus.mockResolvedValue(makeConfirmedOrder());
      orderRepository.logStatusChange.mockResolvedValue({});

      menuRepository.getRecipe
        .mockResolvedValueOnce(makeRecipe(UUID.ING_RICE, 'Rice'))
        .mockResolvedValueOnce(makeRecipe(UUID.ING_PANEER, 'Paneer'));

      stockService.reserveStock.mockResolvedValue({
        ingredient_id: UUID.ING_RICE,
        ingredient_name: 'Rice',
        reserved_quantity: 22,
        available_quantity: 100
      });

      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());
      billingRepository.createInvoice.mockResolvedValue(makeInvoice());
    };

    it('should confirm order, reserve stock for all ingredients, and create invoice', async () => {
      setupConfirmationMocks();

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify DB transaction was used
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      // Verify stock was reserved
      expect(stockService.reserveStock).toHaveBeenCalled();

      // Verify invoice was created
      expect(billingRepository.createInvoice).toHaveBeenCalled();
    });

    it('should save stock reservation records for each ingredient', async () => {
      setupConfirmationMocks();

      await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(orderRepository.saveStockReservation).toHaveBeenCalled();
      const calls = orderRepository.saveStockReservation.mock.calls;
      calls.forEach(call => expect(call[0]).toBe(UUID.ORDER));
    });

    it('should return 404 when confirming a non-existent order', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(404);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // ROLLBACK: INVOICE FAILURE DURING CONFIRMATION
  // ═══════════════════════════════════════════════
  describe('Rollback — Invoice creation failure during confirmation', () => {
    it('should ROLLBACK the transaction if invoice creation fails', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [makeQuotedOrder()] });
        }
        return Promise.resolve({ rows: [] });
      });

      orderRepository.getOrderItems.mockResolvedValue([makeOrderItems()[0]]);
      menuRepository.getRecipe.mockResolvedValue(makeRecipe());
      stockService.reserveStock.mockResolvedValue({
        ingredient_id: UUID.ING_RICE,
        ingredient_name: 'Rice',
        reserved_quantity: 22,
        available_quantity: 80
      });
      orderRepository.saveStockReservation.mockResolvedValue({});

      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());

      // Invoice creation fails
      billingRepository.createInvoice.mockRejectedValue(new Error('DB write error'));
      orderRepository.findOrderById.mockResolvedValue(makeQuotedOrder());

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(orderRepository.updateOrderStatus).not.toHaveBeenCalledWith(UUID.ORDER, 'confirmed');
    });
  });

  // ═══════════════════════════════════════════════
  // ROLLBACK: INSUFFICIENT STOCK
  // ═══════════════════════════════════════════════
  describe('Rollback — Insufficient stock during confirmation', () => {
    it('should ROLLBACK when stock reservation fails due to insufficient quantity', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [makeQuotedOrder()] });
        }
        return Promise.resolve({ rows: [] });
      });

      orderRepository.getOrderItems.mockResolvedValue([makeOrderItems()[0]]);
      menuRepository.getRecipe.mockResolvedValue(makeRecipe());

      stockService.reserveStock.mockRejectedValue(new Error('Insufficient available stock'));

      billingRepository.findQuotationByOrderId.mockResolvedValue(makeQuotation());

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(billingRepository.createInvoice).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // ROLLBACK: EXPIRED QUOTATION
  // ═══════════════════════════════════════════════
  describe('Rollback — Expired quotation on confirmation', () => {
    it('should reject confirmation when the quotation has expired', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [makeQuotedOrder()] });
        }
        return Promise.resolve({ rows: [] });
      });

      const expiredQuotation = makeQuotation({
        valid_until: new Date('2020-01-01')
      });
      billingRepository.findQuotationByOrderId.mockResolvedValue(expiredQuotation);

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(400);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(stockRepository.reserveStock).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // ROLLBACK: CONCURRENT CONFIRMATION GUARD
  // ═══════════════════════════════════════════════
  describe('Rollback — Concurrent confirmation guard', () => {
    it('should reject second confirmation when order is already confirmed (SELECT FOR UPDATE)', async () => {
      mockClient.query.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT * FROM orders WHERE id')) {
          return Promise.resolve({ rows: [makeConfirmedOrder()] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post(`/api/v1/orders/${UUID.ORDER}/confirm`)
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(400);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(stockRepository.reserveStock).not.toHaveBeenCalled();
      expect(billingRepository.createInvoice).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // INVALID STATUS TRANSITIONS
  // ═══════════════════════════════════════════════
  describe('PUT /api/v1/orders/:id/status — Invalid Status Transitions', () => {
    it('should reject confirming a draft order (must be quoted first)', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'confirmed' });

      expect(response.status).toBe(400);
    });

    it('should reject transitioning a completed order to any other status', async () => {
      orderRepository.findOrderById.mockResolvedValue(
        makeDraftOrder({ status: 'completed' })
      );

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'confirmed' });

      expect(response.status).toBe(400);
    });

    it('should reject transitioning a cancelled order', async () => {
      orderRepository.findOrderById.mockResolvedValue(
        makeDraftOrder({ status: 'cancelled' })
      );

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'draft' });

      expect(response.status).toBe(400);
    });

    it('should allow valid transition from confirmed → preparing', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeConfirmedOrder());
      orderRepository.updateOrderStatus.mockResolvedValue(
        makeDraftOrder({ status: 'preparing' })
      );
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'preparing' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('preparing');
    });
  });

  // ═══════════════════════════════════════════════
  // CANCELLATION WITH STOCK RELEASE
  // ═══════════════════════════════════════════════
  describe('PUT /api/v1/orders/:id/status — Cancellation releases stock', () => {
    it('should release reserved stock when a confirmed order is cancelled', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeConfirmedOrder());
      orderRepository.getStockReservations.mockResolvedValue([
        { ingredient_id: UUID.ING_RICE, reserved_quantity: 22 },
        { ingredient_id: UUID.ING_PANEER, reserved_quantity: 10 }
      ]);

      stockService.releaseReservedStock.mockResolvedValue({
        ingredient_id: UUID.ING_RICE,
        ingredient_name: 'Rice',
        available_quantity: 100,
        reserved_quantity: 0
      });

      orderRepository.deleteStockReservations.mockResolvedValue();
      orderRepository.updateOrderStatus.mockResolvedValue(
        makeDraftOrder({ status: 'cancelled' })
      );
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');

      // Verify stock was released for BOTH ingredients
      expect(stockService.releaseReservedStock).toHaveBeenCalledTimes(2);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_RICE, 22);
      expect(stockService.releaseReservedStock).toHaveBeenCalledWith(UUID.ING_PANEER, 10);

      // Verify reservation records were cleaned up
      expect(orderRepository.deleteStockReservations).toHaveBeenCalledWith(UUID.ORDER);
    });

    it('should still cancel even if stock release fails for one ingredient', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeConfirmedOrder());
      orderRepository.getStockReservations.mockResolvedValue([
        { ingredient_id: UUID.ING_RICE, reserved_quantity: 22 },
        { ingredient_id: UUID.ING_PANEER, reserved_quantity: 10 }
      ]);

      stockService.releaseReservedStock
        .mockResolvedValueOnce({ available_quantity: 100, reserved_quantity: 0 })
        .mockRejectedValueOnce(new Error('Release failed'));

      orderRepository.deleteStockReservations.mockResolvedValue();
      orderRepository.updateOrderStatus.mockResolvedValue(
        makeDraftOrder({ status: 'cancelled' })
      );
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'cancelled' });

      // Cancellation should still succeed (business decision: don't block cancellation)
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should NOT release stock when cancelling a draft order', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.updateOrderStatus.mockResolvedValue(
        makeDraftOrder({ status: 'cancelled' })
      );
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .put(`/api/v1/orders/${UUID.ORDER}/status`)
        .set('Authorization', 'Bearer fake_token')
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(stockService.releaseReservedStock).not.toHaveBeenCalled();
      expect(orderRepository.deleteStockReservations).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // ORDER CRUD BASICS
  // ═══════════════════════════════════════════════
  describe('POST /api/v1/orders — Create Order', () => {
    it('should create a new draft order with items', async () => {
      const newOrder = makeDraftOrder();
      orderRepository.createOrder.mockResolvedValue(newOrder);
      orderRepository.createOrderItem.mockResolvedValue({
        id: UUID.ITEM_1,
        order_id: UUID.ORDER,
        menu_item_id: UUID.MENU_1,
        quantity: 10,
        unit_price: 500,
        total_price: 5000
      });
      orderRepository.updateTotalAmount.mockResolvedValue({});
      orderRepository.logStatusChange.mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', 'Bearer fake_token')
        .send({
          event_date: FUTURE_DATE,
          event_time: '18:00',
          event_type: 'Wedding',
          guest_count: 100,
          venue_address: '123 Main Street, Chennai',
          order_items: [
            { menu_item_id: UUID.MENU_1, quantity: 10 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('draft');
    });
  });

  describe('GET /api/v1/orders/:id — Get Order', () => {
    it('should return order details with items and status history', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.getOrderItems.mockResolvedValue(makeOrderItems());
      orderRepository.getStatusHistory.mockResolvedValue([
        { old_status: null, new_status: 'draft', changed_at: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/v1/orders/${UUID.ORDER}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.status_history).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/orders/${UUID.ORDER}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/orders/:id — Delete Order', () => {
    it('should only allow deleting draft orders', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeConfirmedOrder());

      const response = await request(app)
        .delete(`/api/v1/orders/${UUID.ORDER}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(400);
    });

    it('should delete a draft order successfully', async () => {
      orderRepository.findOrderById.mockResolvedValue(makeDraftOrder());
      orderRepository.deleteOrder.mockResolvedValue({});

      const response = await request(app)
        .delete(`/api/v1/orders/${UUID.ORDER}`)
        .set('Authorization', 'Bearer fake_token');

      expect(response.status).toBe(200);
    });
  });
});
