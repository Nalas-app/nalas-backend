# 🏗️ WORKFLOW & IMPLEMENTATION PLAN

## Architecture Overview

```
CATERING MANAGEMENT SYSTEM
├── 👨‍💼 CUSTOMERS → Orders Module → Menu Module
├── 📦 INVENTORY → Stock Module → Ingredient Tracking
├── 💰 FINANCE → Billing Module → Quotations/Invoices/Payments
├── 🤖 OPTIMIZATION → ML-Costing → Cost Predictions
└── 🔐 SECURITY → Auth Module (DONE) → RBAC, JWT
```

---

## DETAILED IMPLEMENTATION WORKFLOW

### **STAGE 1: ORDERS MODULE** (HIGH DEPENDENCY)

**Business Logic:**
- Customers place orders for catering events
- Orders contain menu items with customizations
- Orders have status workflow: draft → quoted → confirmed → preparing → completed/cancelled
- Other modules query orders to get aggregated data

**Files to Create:**
```
src/modules/orders/
├── routes.js          # POST /orders, GET /orders/:id, PUT /orders/:id, DELETE
├── controller.js      # Request handlers
├── service.js         # Business logic: order lifecycle
├── repository.js      # DB queries for orders
└── validators.js      # Schema validation for order creation/updates
```

**Key Endpoints:**
```javascript
POST   /api/v1/orders              // Create new order
GET    /api/v1/orders/:id          // Get order details
GET    /api/v1/orders              // List orders (with filters)
PUT    /api/v1/orders/:id          // Update order
PUT    /api/v1/orders/:id/status   // Change order status
DELETE /api/v1/orders/:id          // Cancel order
GET    /api/v1/orders/:id/items    // Get items in order
```

**Database Tables Used:**
- `orders` (id, customer_id, event_date, status, total_amount, etc.)
- `order_items` (id, order_id, menu_item_id, quantity, price)

**Dependencies:**
- auth.middleware (authenticate customer)
- validate.middleware (validate order data)
- rbac.middleware (verify customer owns order or is admin)

**Estimated Time:** 3-4 hours

---

### **STAGE 2: STOCK MODULE** (INVENTORY TRACKING)

**Business Logic:**
- Track ingredient stock levels
- Record purchase, consumption, wastage, adjustments
- Reserve stock for confirmed orders
- Alert when stock falls below reorder level
- Calculate ingredient costs for billing

**Files to Create:**
```
src/modules/stock/
├── routes.js          # CRUD for ingredients and stock transactions
├── controller.js      # Request handlers
├── service.js         # Stock logic: reservations, consumption
├── repository.js      # DB queries
└── validators.js      # Validation schemas
```

**Key Endpoints:**
```javascript
POST   /api/v1/stock/ingredients              // Add new ingredient
GET    /api/v1/stock/ingredients              // List ingredients
GET    /api/v1/stock/ingredients/:id          // Get ingredient details
PUT    /api/v1/stock/ingredients/:id          // Update ingredient
DELETE /api/v1/stock/ingredients/:id          // Deprecate ingredient

POST   /api/v1/stock/transactions             // Record stock transaction
GET    /api/v1/stock/transactions             // View transaction history
GET    /api/v1/stock/current                  // Get current stock levels
PUT    /api/v1/stock/:ingredientId/reserve   // Reserve stock for order
PUT    /api/v1/stock/:ingredientId/consume   // Consume stock for order
```

**Database Tables Used:**
- `ingredients` (id, name, unit, price, reorder_level)
- `stock_transactions` (id, ingredient_id, type, quantity, unit_price)
- `current_stock` (ingredient_id, available, reserved)

**Dependencies:**
- Needs to integrate with Orders module (when order confirmed, reserve stock)
- Needs to integrate with Billing module (ingredient costs)

**Estimated Time:** 3-4 hours

---

### **STAGE 3: MENU MODULE** (PRODUCT CATALOG)

**Business Logic:**
- Define menu categories (Appetizers, Main Course, Desserts, etc.)
- Define menu items (Biryani, Paneer Tikka, etc.)
- Define recipes (which ingredients go into each item)
- Track customization options

**Files to Create:**
```
src/modules/menu/
├── routes.js          # CRUD for categories and items
├── controller.js      # Request handlers
├── service.js         # Menu logic
├── repository.js      # DB queries
└── validators.js      # Validation schemas
```

**Key Endpoints:**
```javascript
POST   /api/v1/menu/categories                // Create category
GET    /api/v1/menu/categories                // List all categories
GET    /api/v1/menu/categories/:id            // Get category details
PUT    /api/v1/menu/categories/:id            // Update category
DELETE /api/v1/menu/categories/:id            // Archive category

POST   /api/v1/menu/items                     // Create menu item
GET    /api/v1/menu/items                     // List menu items
GET    /api/v1/menu/items/:id                 // Get item details
PUT    /api/v1/menu/items/:id                 // Update item
DELETE /api/v1/menu/items/:id                 // Archive item

GET    /api/v1/menu/items/:id/recipe          // Get recipe for item
POST   /api/v1/menu/items/:id/recipe          // Add recipe ingredients
```

**Database Tables Used:**
- `menu_categories` (id, name, display_order)
- `menu_items` (id, category_id, name, description, price)
- `recipes` (id, menu_item_id, ingredient_id, quantity_needed)

**Dependencies:**
- Needs Stock module data (ingredient costs) for pricing
- Orders module queries this for item selection

**Estimated Time:** 2-3 hours

---

### **STAGE 4: BILLING MODULE** (REVENUE TRACKING)

**Business Logic:**
- Generate quotations from orders (estimated costs + margin)
- Create invoices once order is confirmed
- Track payments received
- Calculate costs based on ingredients + labor + overhead
- Mark invoices as paid/pending/overdue

**Files to Create:**
```
src/modules/billing/
├── routes.js          # CRUD for quotations, invoices, payments
├── controller.js      # Request handlers
├── service.js         # Billing logic: cost calculation, invoice generation
├── repository.js      # DB queries
└── validators.js      # Validation schemas
```

**Key Endpoints:**
```javascript
POST   /api/v1/billing/quotations             // Generate quotation from order
GET    /api/v1/billing/quotations/:id         // View quotation
PUT    /api/v1/billing/quotations/:id         // Update quotation
POST   /api/v1/billing/quotations/:id/accept  // Accept quotation → create invoice

POST   /api/v1/billing/invoices               // Create invoice
GET    /api/v1/billing/invoices               // List invoices
GET    /api/v1/billing/invoices/:id           // View invoice
PUT    /api/v1/billing/invoices/:id/status    // Mark as paid/overdue

POST   /api/v1/billing/payments               // Record payment
GET    /api/v1/billing/payments               // Payment history
```

**Database Tables Used:**
- `quotations` (id, order_id, subtotal, labor_cost, tax, total, valid_until)
- `invoices` (id, order_id, total_amount, paid_amount, payment_status)
- `payments` (id, invoice_id, amount, payment_method, transaction_id)

**Dependencies:**
- Depends on Orders module (knows order items & quantities)
- Depends on Stock module (knows ingredient costs)
- Menu module (item prices)

**Cost Calculation Logic:**
```
Ingredient Cost = sum(recipe quantities × ingredient unit price)
Labor Cost = order item count × labor rate
Overhead Cost = (Ingredient Cost + Labor Cost) × 15%
Discount = applied by admin
Tax = (subtotal - discount) × 18% (GST)
Total = Ingredient + Labor + Overhead + Tax - Discount
```

**Estimated Time:** 3-4 hours

---

### **STAGE 5: ML-COSTING MODULE** (OPTIONAL - If time permits)

**Business Logic:**
- Predict costs based on historical data
- Adjust predictions based on demand/season
- Analyze profitability trends
- Recommend pricing based on market data

**Files to Create:**
```
src/modules/ml-costing/
├── routes.js          # Endpoints for predictions
├── controller.js      # Request handlers
├── service.js         # ML model integration
└── validators.js      # Validation schemas
```

**Key Endpoints:**
```javascript
POST   /api/v1/ml-costing/predict             // Get cost prediction
GET    /api/v1/ml-costing/analytics           // Historical analysis
GET    /api/v1/ml-costing/trends              // Trend analysis
POST   /api/v1/ml-costing/train               // Train model (admin only)
```

**Database Tables Used:**
- `ml_cost_predictions` (order_item_id, ingredient_cost, labor_cost, predicted_total)

**Estimated Time:** 2-3 hours (if implemented simply without complex ML)

---

## Implementation Pattern (Use for ALL modules)

Each module follows this structure:

### **validators.js** (First - Define your data contracts)
```javascript
const Joi = require('joi');

const createOrderSchema = Joi.object({
  event_date: Joi.date().required(),
  guest_count: Joi.number().min(10).required(),
  // ... more validations
});

module.exports = { createOrderSchema, ... };
```

### **repository.js** (Second - Database layer)
```javascript
class OrderRepository {
  async createOrder(data) {
    const query = `INSERT INTO orders (...) VALUES (...) RETURNING *`;
    const result = await db.query(query, [data.field1, ...]);
    return result.rows[0];
  }
  // More methods...
}

module.exports = new OrderRepository();
```

### **service.js** (Third - Business logic)
```javascript
class OrderService {
  async createOrder(orderData) {
    // Validate business rules
    // Call repository
    // Return formatted response
    const order = await orderRepository.createOrder(orderData);
    return { id: order.id, ... };
  }
  // More methods...
}

module.exports = new OrderService();
```

### **controller.js** (Fourth - Request handlers)
```javascript
class OrderController {
  async create(req, res, next) {
    try {
      const result = await orderService.createOrder(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);  // Pass to error middleware
    }
  }
  // More handlers...
}

module.exports = new OrderController();
```

### **routes.js** (Last - Wire it up)
```javascript
const express = require('express');
const controller = require('./controller');
const { validate } = require('./validators');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.post('/', 
  authenticate, 
  validate(createOrderSchema), 
  controller.create
);
// More routes...

module.exports = router;
```

### **app.js** (Register route)
```javascript
app.use('/api/v1/orders', require('./modules/orders/routes'));
```

---

## Key Technical Decisions

1. **Error Handling:** Use `AppError` class (already implemented)
   ```javascript
   throw AppError.badRequest('Invalid order data', { field: 'error message' });
   ```

2. **Response Format:** Consistent JSON structure
   ```javascript
   { 
     success: true/false,
     data: { ... },
     message: "Human readable message"
   }
   ```

3. **Database Queries:** Always use parameterized queries (prevent SQL injection)
   ```javascript
   db.query('SELECT * FROM users WHERE id = $1', [userId])
   ```

4. **Authentication:** Every protected endpoint needs `authenticate` middleware
   ```javascript
   router.get('/', authenticate, controller.list);
   ```

5. **Validation:** Always validate input in routes
   ```javascript
   router.post('/', validate(schema), controller.create);
   ```

---

## Testing Strategy

- Unit tests for service layer (business logic)
- Integration tests for API endpoints
- Run tests: `npm test`
- Check coverage: `npm test -- --coverage`

---

## Database Migration

Once all modules are ready:
```bash
psql -h yourdomain -U user -d database < src/database/migrations/001_initial_schema.sql
# Or use migration tool (not yet set up)
```

