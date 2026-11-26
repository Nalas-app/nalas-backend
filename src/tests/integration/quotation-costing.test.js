const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');
const mlClient = require('../../shared/utils/mlClient');

jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn(), end: jest.fn() }
}));

jest.mock('../../shared/utils/mlClient', () => ({
  predictCost: jest.fn(),
  getHealth: jest.fn()
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const app = require('../../app');
const {
  computeRecipeUnitCost,
  estimateDishUnitCost,
  resolveDishUnitCost
} = require('../../shared/utils/dishCost');

const adminToken = jwt.sign(
  { userId: '11111111-1111-4111-8111-111111111111', email: 'admin@magilamfoods.com', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const customerToken = jwt.sign(
  { userId: '22222222-2222-4222-8222-222222222222', email: 'cust@example.com', role: 'customer' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const DEFAULT_CONFIG = {
  labour_cost_per_guest: 500,
  lpg_cost_per_guest: 30,
  transport_flat: 1000,
  leaf_cost_per_guest: 10,
  disposables_cost_per_guest: 20,
  overhead_percentage: 10,
  profit_percentage: 25,
  gst_percentage: 18
};

describe('Dish Cost & Quotation Calculation Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dishCost utility', () => {
    it('computes recipe unit cost with wastage and guards against unscaled batch outliers', () => {
      const normalRecipe = [
        { quantity_per_base_unit: '0.15', wastage_factor: '1.05', current_price_per_unit: '100' },
        { quantity_per_base_unit: '0.20', wastage_factor: '1.05', current_price_per_unit: '220' }
      ];
      // 0.15 * 1.05 * 100 (15.75) + 0.20 * 1.05 * 220 (46.20) = 61.95
      expect(computeRecipeUnitCost(normalRecipe)).toBe(61.95);

      // Corrupted M Varuval gram-as-kg row (2000 * 1.05 * 830 = 1,743,000) must return 0 so dish fallback runs
      const corruptedRecipe = [
        { quantity_per_base_unit: '2000', wastage_factor: '1.05', current_price_per_unit: '830' }
      ];
      expect(computeRecipeUnitCost(corruptedRecipe)).toBe(0);
    });

    it('replaces legacy 500 placeholder unit_price with dish estimate when no recipe exists', () => {
      const legacyItem = { name: 'Plain Dosa', category_name: 'Dosa Varieties', unit_price: '500.00' };
      const resolved = resolveDishUnitCost({ item: legacyItem, recipeRows: [], ignoreLegacyPlaceholder: true });
      expect(resolved.method).toBe('dish_estimate');
      expect(resolved.unitCost).toBe(45);

      const explicitItem = { name: 'Plain Dosa', category_name: 'Dosa Varieties', unit_price: '55.00' };
      const resolvedExplicit = resolveDishUnitCost({ item: explicitItem, recipeRows: [], ignoreLegacyPlaceholder: true });
      expect(resolvedExplicit.method).toBe('item_unit_price');
      expect(resolvedExplicit.unitCost).toBe(55);

      expect(estimateDishUnitCost({ name: 'Chicken Biriyani', category_name: 'Biryani Varieties' }))
        .toBeGreaterThan(estimateDishUnitCost({ name: 'Idli', category_name: 'Idli Varieties' }));
    });
  });

  describe('POST /api/v1/orders (preserves customer unit_price instead of stripping to 500)', () => {
    it('retains valid unit_price from customer app and computes accurate draft total', async () => {
      const dosaId = '33333333-3333-4333-8333-333333333333';
      const orderId = '44444444-4444-4444-8444-444444444444';
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // 1. createOrder INSERT orders
      db.query.mockResolvedValueOnce({
        rows: [{
          id: orderId,
          customer_id: '22222222-2222-4222-8222-222222222222',
          event_date: futureDate,
          event_time: '18:00',
          event_type: 'House Functions',
          guest_count: 100,
          venue_address: 'Coimbatore 10, Tamil Nadu',
          status: 'draft'
        }]
      });
      // 2. findMenuItemById
      db.query.mockResolvedValueOnce({
        rows: [{ id: dosaId, name: 'Plain Dosa', category_name: 'Dosa Varieties', min_quantity: 10 }]
      });
      // 3. getRecipe (empty -> uses client unit_price = 45)
      db.query.mockResolvedValueOnce({ rows: [] });
      // 4. createOrderItem
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'oi-1', order_id: orderId, menu_item_id: dosaId, quantity: 100, unit_price: 45, total_price: 4500 }]
      });
      // 5. updateTotalAmount
      db.query.mockResolvedValueOnce({ rows: [{ id: orderId, total_amount: 4500 }] });
      // 6. logStatusChange
      db.query.mockResolvedValueOnce({ rows: [{}] });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          event_date: futureDate,
          event_time: '18:00',
          event_type: 'House Functions',
          guest_count: 100,
          venue_address: 'Coimbatore 10, Tamil Nadu',
          order_items: [
            { menu_item_id: dosaId, quantity: 100, unit_price: 45 }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.total_amount).toBe(4500);
      expect(res.body.data.items[0].unit_price).toBe(45);
    });
  });

  describe('POST /api/v1/billing/quotations & GET /api/v1/billing/quotations/:id', () => {
    it('calculates distinct dish-driven totals instead of static ₹92,482.5 and stores rawSubtotal', async () => {
      const orderA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const orderB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      // --- Order A: 100 guests, 100 Plain Dosas (legacy 500 placeholder, no recipe -> ₹45 * 100 = ₹4,500 dish cost) ---
      db.query
        // findOrderById
        .mockResolvedValueOnce({ rows: [{ id: orderA, guest_count: 100, status: 'draft' }] })
        // findQuotationByOrderId
        .mockResolvedValueOnce({ rows: [] })
        // getSetting('quotation_config')
        .mockResolvedValueOnce({ rows: [{ key: 'quotation_config', value: DEFAULT_CONFIG }] })
        // getOrderItems
        .mockResolvedValueOnce({
          rows: [{ id: 'oi-a', menu_item_id: 'item-dosa', name: 'Plain Dosa', category_name: 'Dosa Varieties', quantity: '100', unit_price: '500.00' }]
        })
        // getRecipe (empty)
        .mockResolvedValueOnce({ rows: [] })
        // updateOrderItemPricing (syncs 500 -> 45)
        .mockResolvedValueOnce({ rows: [{ id: 'oi-a', unit_price: 45, total_price: 4500 }] })
        // createQuotation INSERT
        .mockImplementationOnce(async (_sql, params) => ({
          rows: [{
            id: 'quot-a',
            order_id: params[0],
            quotation_number: params[1],
            subtotal: params[2],
            labor_cost: params[3],
            overhead_cost: params[4],
            discount: params[5],
            tax_amount: params[6],
            grand_total: params[7],
            valid_until: params[8]
          }]
        }))
        // updateTotalAmount on orders
        .mockResolvedValueOnce({ rows: [{ id: orderA }] });

      const resA = await request(app)
        .post('/api/v1/billing/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order_id: orderA, apply_gst: true });

      expect(resA.statusCode).toBe(201);
      // Dish cost = 4,500; fixed = 57,000 => rawSubtotal = 61,500; overhead (10%) = 6,150
      // subtotal = 67,650; profit (25%) = 16,912.5; selling = 84,562.5; GST (18%) = 15,221.25; grand_total = 99,783.75
      expect(resA.body.data.breakdown.ingredient_cost).toBe(4500);
      expect(resA.body.data.subtotal).toBe(61500); // true rawSubtotal stored, NOT sellingPrice!
      expect(resA.body.data.breakdown.overhead_cost).toBe(6150);
      expect(resA.body.data.grand_total).toBe(99783.75);
      expect(resA.body.data.grand_total).not.toBe(92482.5);

      // --- Order B: 100 guests, 200 Chicken Biriyanis (₹220 * 200 = ₹44,000 dish cost) ---
      db.query
        .mockResolvedValueOnce({ rows: [{ id: orderB, guest_count: 100, status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ key: 'quotation_config', value: DEFAULT_CONFIG }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'oi-b', menu_item_id: 'item-biryani', name: 'Chicken Biriyani', category_name: 'Biryani Varieties', quantity: '200', unit_price: '500.00' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'oi-b', unit_price: 220, total_price: 44000 }] })
        .mockImplementationOnce(async (_sql, params) => ({
          rows: [{
            id: 'quot-b',
            order_id: params[0],
            quotation_number: params[1],
            subtotal: params[2],
            labor_cost: params[3],
            overhead_cost: params[4],
            discount: params[5],
            tax_amount: params[6],
            grand_total: params[7],
            valid_until: params[8]
          }]
        }))
        .mockResolvedValueOnce({ rows: [{ id: orderB }] });

      const resB = await request(app)
        .post('/api/v1/billing/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order_id: orderB, apply_gst: true });

      expect(resB.statusCode).toBe(201);
      expect(resB.body.data.breakdown.ingredient_cost).toBe(44000);
      expect(resB.body.data.grand_total).toBeGreaterThan(resA.body.data.grand_total);

      // --- GET /api/v1/billing/quotations/:id returns full breakdown with exact ingredient_cost ---
      const quotId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      db.query
        // findQuotationById
        .mockResolvedValueOnce({
          rows: [{
            id: quotId,
            order_id: orderA,
            quotation_number: 'QUOT-123',
            subtotal: '61500.00',
            labor_cost: '50000.00',
            overhead_cost: '6150.00',
            discount: '0.00',
            tax_amount: '15221.25',
            grand_total: '99783.75'
          }]
        })
        // getSetting('quotation_config')
        .mockResolvedValueOnce({ rows: [{ key: 'quotation_config', value: DEFAULT_CONFIG }] })
        // findOrderById
        .mockResolvedValueOnce({ rows: [{ id: orderA, guest_count: 100 }] });

      const getRes = await request(app)
        .get(`/api/v1/billing/quotations/${quotId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.data.breakdown).toBeDefined();
      expect(getRes.body.data.breakdown.ingredient_cost).toBe(4500);
      expect(getRes.body.data.breakdown.overhead_cost).toBe(6150);
      expect(getRes.body.data.breakdown.profit_amount).toBe(16912.5);
    });

    it('handles legacy quotation rows where sellingPrice was stored in subtotal without showing fake ₹21,375 ingredient cost', async () => {
      const legacyQuotId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const orderId = '224189b8-1abd-460c-b664-a8ab87717f8a';

      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: legacyQuotId,
            order_id: orderId,
            quotation_number: 'QUOT-LEGACY',
            subtotal: '78375.00',
            labor_cost: '50000.00',
            overhead_cost: '5700.00',
            discount: '0.00',
            tax_amount: '14107.50',
            grand_total: '92482.50'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ key: 'quotation_config', value: DEFAULT_CONFIG }] })
        .mockResolvedValueOnce({ rows: [{ id: orderId, guest_count: 100 }] });

      const getRes = await request(app)
        .get(`/api/v1/billing/quotations/${legacyQuotId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.data.breakdown.ingredient_cost).toBe(0);
      expect(getRes.body.data.breakdown.profit_amount).toBe(15675);
    });
  });

  describe('POST /api/v1/orders/:id/quotation', () => {
    it('uses ML raw ingredientCost (not totalCost) and still passes dish_cost when ML fails', async () => {
      const orderId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      mlClient.predictCost.mockRejectedValueOnce(new Error('ML 404 item not found'));

      db.query
        // findOrderById (in OrderService.generateQuotation)
        .mockResolvedValueOnce({ rows: [{ id: orderId, guest_count: 100, event_date: '2026-12-10', status: 'draft' }] })
        // getOrderItems
        .mockResolvedValueOnce({
          rows: [{ id: 'oi-1', menu_item_id: 'm-1', name: 'Paneer Pulav', category_name: 'Pulav Varieties', quantity: '100', unit_price: '500.00' }]
        })
        // getRecipe (empty -> tries ML -> falls back to dish estimate ₹145 * 100 = ₹14,500)
        .mockResolvedValueOnce({ rows: [] })
        // updateOrderItemPricing
        .mockResolvedValueOnce({ rows: [{}] })
        // billingService.createQuotation -> findOrderById
        .mockResolvedValueOnce({ rows: [{ id: orderId, guest_count: 100, status: 'draft' }] })
        // findQuotationByOrderId
        .mockResolvedValueOnce({ rows: [] })
        // getSetting('quotation_config')
        .mockResolvedValueOnce({ rows: [{ key: 'quotation_config', value: DEFAULT_CONFIG }] })
        // billingRepository.createQuotation
        .mockImplementationOnce(async (_sql, params) => ({
          rows: [{
            id: 'quot-e',
            order_id: params[0],
            quotation_number: params[1],
            subtotal: params[2],
            labor_cost: params[3],
            overhead_cost: params[4],
            discount: params[5],
            tax_amount: params[6],
            grand_total: params[7],
            valid_until: params[8]
          }]
        }))
        // updateTotalAmount inside billingService.createQuotation
        .mockResolvedValueOnce({ rows: [{ id: orderId }] })
        // updateOrderStatus('quoted')
        .mockResolvedValueOnce({ rows: [{ id: orderId, status: 'quoted' }] })
        // updateTotalAmount inside orderService.generateQuotation
        .mockResolvedValueOnce({ rows: [{ id: orderId }] })
        // logStatusChange
        .mockResolvedValueOnce({ rows: [{}] });

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/quotation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ apply_gst: true });

      expect(res.statusCode).toBe(200);
      // 100 Paneer Pulavs @ ₹145 = ₹14,500 dish cost passed into quotation (NOT dropped to 0!)
      expect(res.body.data.quotation.breakdown.ingredient_cost).toBe(14500);
      expect(res.body.data.quotation.grand_total).toBeGreaterThan(92482.5);
    });
  });
});
