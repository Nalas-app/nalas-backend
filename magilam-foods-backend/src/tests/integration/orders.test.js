const request = require('supertest');
const app = require('../../../src/app');

// Mock a valid token for auth middleware
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ id: '1', role: 'admin' })
}));

const orderRepository = require('../../../src/modules/orders/repository');
const menuRepository = require('../../../src/modules/menu/repository');
const billingRepository = require('../../../src/modules/billing/repository');
const stockRepository = require('../../../src/modules/stock/repository');

jest.mock('../../../src/modules/orders/repository');
jest.mock('../../../src/modules/menu/repository');
jest.mock('../../../src/modules/billing/repository');
jest.mock('../../../src/modules/stock/repository');

describe('Orders and Integration Module API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/orders/:id/quotation', () => {
    it('should generate a quotation for an existing order', async () => {
      orderRepository.findOrderById.mockResolvedValue({ id: '123', status: 'draft', guest_count: 50 });
      orderRepository.getOrderItems.mockResolvedValue([{ id: 'item1', menu_item_id: 'm1', quantity: 2 }]);
      
      menuRepository.getRecipe.mockResolvedValue([{
        quantity_per_base_unit: 1,
        wastage_factor: 1.1,
        current_price_per_unit: 100
      }]);
      
      billingRepository.findQuotationByOrderId.mockResolvedValue(null);
      billingRepository.createQuotation.mockResolvedValue({
        id: 'q1',
        order_id: '123',
        quotation_number: 'QUOT-12345',
        subtotal: 1000,
        labor_cost: 0,
        overhead_cost: 0,
        discount: 0,
        tax_amount: 180,
        grand_total: 1180,
        created_at: new Date()
      });
      
      orderRepository.updateOrderStatus.mockResolvedValue({ id: '123', status: 'quoted' });

      const response = await request(app)
        .post('/api/v1/orders/123/quotation')
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quotation.quotation_number).toBe('QUOT-12345');
    });

    it('should return 404 if order does not exist', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/orders/999/quotation')
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/orders/:id/confirm', () => {
    it('should confirm order, reserve stock, and create invoice', async () => {
      orderRepository.findOrderById.mockResolvedValue({ id: '123', status: 'quoted' });
      orderRepository.getOrderItems.mockResolvedValue([{ id: 'item1', menu_item_id: 'm1', quantity: 1 }]);
      
      menuRepository.getRecipe.mockResolvedValue([{
        ingredient_id: 'ing1',
        quantity_per_base_unit: 5,
        wastage_factor: 1.0
      }]);
      
      stockRepository.findIngredientById.mockResolvedValue({ id: 'ing1', name: 'Ingredient 1' });
      stockRepository.reserveStock.mockResolvedValue({
        ingredient_id: 'ing1',
        available_quantity: 95,
        reserved_quantity: 5
      });
      
      orderRepository.saveStockReservation.mockResolvedValue({});
      billingRepository.findQuotationByOrderId.mockResolvedValue({ id: 'q1', order_id: '123', grand_total: 1000 });
      billingRepository.createInvoice.mockResolvedValue({ id: 'inv1', invoice_number: 'INV-123', total_amount: 1000 });
      orderRepository.updateOrderStatus.mockResolvedValue({ id: '123', status: 'confirmed' });

      const response = await request(app)
        .post('/api/v1/orders/123/confirm')
        .set('Authorization', 'Bearer fake_token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
