# 🍽️ Magilam Foods — Catering Management System Backend

A production-grade **Node.js + Express** backend for managing end-to-end catering operations — from menu planning and order placement to stock reservation, billing, and ML-based cost prediction.

---

## 📑 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Order Lifecycle](#order-lifecycle)
- [Cross-Module Integration Flows](#cross-module-integration-flows)
- [Testing](#testing)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Team Responsibilities](#team-responsibilities)

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client     │────▶│  Express    │────▶│ PostgreSQL  │
│  (Frontend)  │◀────│  REST API   │◀────│  Database   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  ML Service │
                    │  (Python)   │
                    └─────────────┘
```

The system follows a **modular layered architecture** with clear separation of concerns:

```
Routes → Controller → Service → Repository → Database
```

Each module (Orders, Stock, Billing, Menu, ML-Costing) follows the same pattern:
- **Routes** — Define endpoints, apply middleware (auth, RBAC, validation)
- **Controller** — Handle HTTP request/response
- **Service** — Business logic, cross-module orchestration
- **Repository** — Raw SQL queries (PostgreSQL via `pg`)
- **Validators** — Joi schemas for request validation

---

## Tech Stack

| Layer          | Technology                |
|----------------|---------------------------|
| Runtime        | Node.js                   |
| Framework      | Express.js 4.x            |
| Database       | PostgreSQL (via `pg`)     |
| Authentication | JWT (`jsonwebtoken`)      |
| Validation     | Joi                       |
| Security       | Helmet, CORS, Rate Limiting |
| Logging        | Winston                   |
| ML Integration | Axios → External Python ML Service |
| Scheduling     | node-cron                 |
| Testing        | Jest + Supertest          |

---

## Project Structure

```
nalas-backend/
├── package.json
├── README.md
└── src/
    ├── app.js                         # Express app entry point
    ├── config/
    │   ├── database.js                # PostgreSQL connection pool
    │   └── env.js                     # Environment config
    ├── database/
    │   ├── migrations/
    │   │   ├── 001_initial_schema.sql
    │   │   ├── 002_add_order_integration_tables.sql
    │   │   └── 003_add_ingredient_type.sql
    │   ├── runMigrations.js
    │   └── runSingleMigration.js
    ├── middlewares/
    │   ├── auth.middleware.js          # JWT authentication
    │   ├── error.middleware.js         # Global error handler
    │   ├── rbac.middleware.js          # Role-based access control
    │   └── validate.middleware.js      # Joi validation middleware
    ├── modules/
    │   ├── auth/                      # Registration & Login
    │   ├── orders/                    # Order management & lifecycle
    │   ├── stock/                     # Ingredient & inventory management
    │   ├── menu/                      # Menu categories, items & recipes
    │   ├── billing/                   # Quotations, invoices & payments
    │   └── ml-costing/                # ML cost predictions & analytics
    ├── scripts/
    │   ├── extract_client_data.py     # Data extraction utility
    │   ├── seed-client-data.js        # Database seeding
    │   └── validate-data.js           # Cross-module data validation
    ├── shared/
    │   ├── errors/                    # Custom error classes
    │   └── utils/
    │       └── logger.js              # Winston logger
    └── tests/
        ├── setup.js                   # Global test mocks (DB, axios, logger)
        └── integration/
            ├── order-stock-billing.test.js  # Full E2E lifecycle tests
            ├── orders.test.js               # Order module integration tests
            └── billing.test.js              # Billing module integration tests
```

---

## Modules

### 🔐 Auth
- User registration with password hashing (bcryptjs)
- JWT-based login with role assignment (`customer`, `admin`, `super_admin`)

### 📋 Orders
- Full CRUD for catering orders
- Status state machine: `draft → quoted → confirmed → preparing → completed`
- Cancellation from any active state (with stock release)
- Quotation generation with ML prediction or recipe-based fallback
- Order confirmation triggers **stock reservation** + **invoice creation** in a single DB transaction

### 📦 Stock
- Ingredient CRUD with unit tracking
- Stock transactions (purchase, consumption, wastage, adjustment)
- Real-time stock levels (available vs. reserved)
- Procurement alerts for low-stock items
- Stock reservation/release tied to order lifecycle
- Reorder level monitoring

### 🍽️ Menu
- Category management with display ordering
- Menu item CRUD (with customization support)
- Recipe management — maps menu items to ingredients with quantities and wastage factors

### 💰 Billing
- **Quotations** — Auto-generated from recipe-based costing (ingredient cost + labor + overhead + tax)
- **Invoices** — Created on order confirmation, linked to quotation grand total
- **Payments** — Track partial/full payments with status transitions (`pending → partial → paid`)
- **Refunds** — Process refunds with paid amount validation
- **Cron Jobs** — Automated overdue invoice detection

### 🤖 ML Costing
- Cost predictions via external ML service (XGBoost)
- Per-item prediction with confidence scores
- Graceful fallback to recipe-based costing when ML is unavailable
- Analytics and trend tracking

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication (`Bearer <JWT>`) is required unless noted.

### Auth — `/api/v1/auth`
| Method | Endpoint     | Auth | Description          |
|--------|-------------|------|----------------------|
| POST   | `/register` | ✗    | Register new user    |
| POST   | `/login`    | ✗    | Login & get JWT      |

### Orders — `/api/v1/orders`
| Method | Endpoint              | Role          | Description                                   |
|--------|-----------------------|---------------|-----------------------------------------------|
| GET    | `/`                   | Admin         | List all orders (paginated)                   |
| GET    | `/my-orders`          | Any           | Get current user's orders                     |
| POST   | `/`                   | Any           | Create new draft order                        |
| GET    | `/:id`                | Any           | Get order with items & status history         |
| PUT    | `/:id`                | Any           | Update draft order                            |
| POST   | `/:id/quotation`      | Admin         | Generate quotation (ML or recipe-based)       |
| POST   | `/:id/confirm`        | Admin         | Confirm order (reserves stock + creates invoice) |
| PUT    | `/:id/status`         | Any           | Update status (validates transitions)         |
| DELETE | `/:id`                | Any           | Delete draft order only                       |

### Stock — `/api/v1/stock`
| Method | Endpoint                       | Role  | Description                       |
|--------|--------------------------------|-------|-----------------------------------|
| GET    | `/ingredients`                 | Any   | List all ingredients              |
| POST   | `/ingredients`                 | Admin | Create ingredient                 |
| GET    | `/ingredients/:id`             | Any   | Get ingredient details            |
| PUT    | `/ingredients/:id`             | Admin | Update ingredient                 |
| DELETE | `/ingredients/:id`             | Admin | Delete ingredient                 |
| POST   | `/transactions`                | Admin | Record stock transaction          |
| GET    | `/ingredients/:id/transactions`| Any   | Get transaction history           |
| GET    | `/current/:id`                 | Any   | Get stock level for ingredient    |
| GET    | `/current`                     | Any   | List all stock levels             |
| GET    | `/alerts/procurement`          | Admin | Get low-stock procurement alerts  |
| POST   | `/reserve/:id`                 | Admin | Reserve stock for order           |
| POST   | `/release/:id`                 | Admin | Release reserved stock            |

### Menu — `/api/v1/menu`
| Method | Endpoint                   | Role  | Description                    |
|--------|----------------------------|-------|--------------------------------|
| GET    | `/categories`              | Any   | List all categories            |
| POST   | `/categories`              | Admin | Create category                |
| GET    | `/categories/:id`          | Any   | Get category details           |
| PUT    | `/categories/:id`          | Admin | Update category                |
| DELETE | `/categories/:id`          | Admin | Delete category                |
| GET    | `/items`                   | Any   | List menu items                |
| POST   | `/items`                   | Admin | Create menu item               |
| GET    | `/items/:id`               | Any   | Get menu item details          |
| PUT    | `/items/:id`               | Admin | Update menu item               |
| DELETE | `/items/:id`               | Admin | Delete menu item               |
| GET    | `/items/:id/recipe`        | Any   | Get recipe for menu item       |
| POST   | `/items/:id/recipe`        | Admin | Add ingredient to recipe       |
| DELETE | `/items/:id/recipe`        | Admin | Remove ingredient from recipe  |

### Billing — `/api/v1/billing`
| Method | Endpoint                     | Role  | Description                        |
|--------|------------------------------|-------|------------------------------------|
| POST   | `/quotations`                | Admin | Create quotation                   |
| GET    | `/quotations/:id`            | Any   | Get quotation details              |
| GET    | `/quotations`                | Admin | List all quotations                |
| POST   | `/invoices`                  | Admin | Create invoice                     |
| GET    | `/invoices/:id`              | Any   | Get invoice with payment summary   |
| GET    | `/invoices`                  | Any   | List all invoices                  |
| POST   | `/payments`                  | Any   | Record payment                     |
| GET    | `/invoices/:id/payments`     | Any   | Get payments for invoice           |
| POST   | `/payments/refund`           | Admin | Process refund                     |

### ML Costing — `/api/v1/ml-costing`
| Method | Endpoint               | Role  | Description                     |
|--------|------------------------|-------|---------------------------------|
| POST   | `/predictions`         | Admin | Create ML cost prediction       |
| GET    | `/predictions/:id`     | Any   | Get prediction details          |
| GET    | `/predictions`         | Admin | List all predictions            |
| GET    | `/analytics`           | Admin | Get costing analytics           |
| GET    | `/trends`              | Admin | Get costing trends              |
| GET    | `/items/:id/trend`     | Admin | Get trend for specific item     |

### Health Check
| Method | Endpoint  | Auth | Description           |
|--------|----------|------|-----------------------|
| GET    | `/health`| ✗    | Server health status  |

---

## Database Schema

### Entity Relationship

```
users ─────────────┐
  │                 │
  ▼                 ▼
user_profiles    orders ──────────── order_items
                   │                    │
                   ├── quotations       ├── ml_cost_predictions
                   │                    │
                   └── invoices         └── menu_items
                        │                    │
                        └── payments         ├── menu_categories
                                             │
                                             └── recipes
                                                  │
                                                  └── ingredients
                                                       │
                                                       ├── stock_transactions
                                                       └── current_stock
```

### Key Tables

| Table                 | Purpose                                          |
|-----------------------|--------------------------------------------------|
| `users`               | Auth accounts with role (customer/admin/super_admin) |
| `user_profiles`       | Extended user info                               |
| `menu_categories`     | Food categories (Starters, Mains, Desserts...)   |
| `menu_items`          | Individual dishes with base unit & pricing       |
| `recipes`             | Ingredient-to-menu mapping with quantities       |
| `ingredients`         | Raw materials with pricing & reorder levels      |
| `stock_transactions`  | Purchase/consumption/wastage audit trail         |
| `current_stock`       | Real-time available & reserved quantities        |
| `orders`              | Catering event orders with status tracking       |
| `order_items`         | Line items per order                             |
| `quotations`          | Cost estimates with detailed breakdowns          |
| `invoices`            | Billing documents with payment tracking          |
| `payments`            | Individual payment records                       |
| `ml_cost_predictions` | ML model predictions per order item              |

---

## Order Lifecycle

```
              ┌──────────────────────────────────┐
              │          STATE MACHINE            │
              │                                   │
              │   draft ──▶ quoted ──▶ confirmed  │
              │     │                     │       │
              │     │              preparing      │
              │     │                     │       │
              │     │              completed      │
              │     │                             │
              │     └──────▶ cancelled ◀──────────│
              │        (from any active state)    │
              └──────────────────────────────────┘
```

### What happens at each transition:

| Transition | Trigger | Side Effects |
|------------|---------|--------------|
| `draft → quoted` | `POST /:id/quotation` | Recipe/ML costing calculated, quotation record created |
| `quoted → confirmed` | `POST /:id/confirm` | **DB Transaction**: Stock reserved for all ingredients → Invoice created → Status updated |
| `confirmed → preparing` | `PUT /:id/status` | Status log entry |
| `preparing → completed` | `PUT /:id/status` | Status log entry |
| `* → cancelled` | `PUT /:id/status` | Reserved stock released, reservation records cleaned up |

---

## Cross-Module Integration Flows

### Order Confirmation (the critical path)

```
POST /api/v1/orders/:id/confirm
        │
        ▼
   ┌─ BEGIN TRANSACTION ──────────────────────────────┐
   │                                                   │
   │  1. Lock order row (SELECT FOR UPDATE)            │
   │  2. Validate order status === 'quoted'            │
   │  3. Fetch quotation → verify not expired          │
   │  4. Fetch order items                             │
   │  5. For each item → get recipe ingredients        │
   │  6. Aggregate shared ingredients                  │
   │  7. Reserve stock for each ingredient             │
   │  8. Save reservation records                      │
   │  9. Create invoice from quotation total           │
   │ 10. Update order status → 'confirmed'             │
   │                                                   │
   └─ COMMIT (or ROLLBACK on any failure) ────────────┘
```

**Rollback guarantees:**
- If stock reservation fails mid-way → entire transaction rolls back
- If invoice creation fails after stock reserved → entire transaction rolls back
- No partial state: all-or-nothing

---

## Testing

### Test Suite Overview

The project includes **35 end-to-end integration tests** covering the interconnected Order → Stock → Billing flows.

```
src/tests/integration/
├── order-stock-billing.test.js   (8 tests)  — Full E2E lifecycle
├── orders.test.js                (15 tests) — Order module integration
└── billing.test.js               (12 tests) — Billing module integration
```

### Test Coverage Matrix

#### ✅ Happy Paths
| Test | File | Description |
|------|------|-------------|
| Complete lifecycle | `order-stock-billing` | `draft → quoted → confirmed → preparing → completed` |
| Multi-ingredient aggregation | `order-stock-billing` | Shared ingredients (e.g., spices) aggregated correctly |
| Payment lifecycle | `order-stock-billing` | `pending → partial → paid` |
| ML prediction | `orders` | ML cost prediction when service is available |
| Recipe fallback | `orders` | Falls back to recipe costing when ML is down |
| ML mixed fallback | `order-stock-billing` | Per-item ML/recipe hybrid costing |
| Order CRUD | `orders` | Create, read, delete draft orders |
| Billing CRUD | `billing` | Quotations, invoices, payment history |

#### 🛡️ Rollback Safeguards
| Test | File | Description |
|------|------|-------------|
| Cancellation + stock release | `order-stock-billing` | All 6 ingredients released on cancel |
| Partial stock failure | `order-stock-billing` | All-or-nothing: ROLLBACK if 3rd ingredient fails |
| No quotation guard | `order-stock-billing` | Reject confirm without quotation |
| Invoice failure rollback | `orders` | ROLLBACK when invoice creation fails |
| Insufficient stock | `orders` | ROLLBACK when stock is insufficient |
| Expired quotation | `orders` | Reject confirm with expired quotation |
| Concurrent confirmation | `orders` | SELECT FOR UPDATE prevents double-confirm |
| Refund validation | `billing` | Reject refund > paid amount |
| Graceful degradation | `orders` | Cancel succeeds even if stock release partially fails |
| Invalid transitions | `orders` | `draft→confirmed`, `completed→*`, `cancelled→*` rejected |

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run only integration tests
npx jest --testPathPattern="src/tests/integration" --verbose

# Run a specific test file
npx jest src/tests/integration/order-stock-billing.test.js --verbose
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nalas-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Run all migrations
node src/database/runMigrations.js

# (Optional) Seed sample data
node src/scripts/seed-client-data.js

# (Optional) Validate data integrity
node src/scripts/validate-data.js
```

### Running the Server

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:3000` by default.

---

## Environment Variables

| Variable           | Description                    | Default                    |
|--------------------|--------------------------------|----------------------------|
| `PORT`             | Server port                    | `3000`                     |
| `NODE_ENV`         | Environment                    | `development`              |
| `DATABASE_URL`     | PostgreSQL connection string   | —                          |
| `JWT_SECRET`       | Secret key for JWT signing     | —                          |
| `ALLOWED_ORIGINS`  | Comma-separated CORS origins   | `http://localhost:3000`    |
| `ML_SERVICE_URL`   | ML prediction service URL      | —                          |

---

## Scripts

| Command          | Description                                |
|------------------|--------------------------------------------|
| `npm run dev`    | Start dev server with Nodemon hot-reload   |
| `npm start`      | Start production server                    |
| `npm test`       | Run all tests with coverage                |
| `npm run lint`   | Run ESLint on source files                 |

---

## Team Responsibilities

| Member              | Responsibility                                                  |
|---------------------|-----------------------------------------------------------------|
| **Jai**             | DB migration scripts, ML model integration, rollout oversight   |
| **Nethra**          | Testing support, concurrent confirmation workflow bug fixes     |
| **Pranav Kishan**   | Cross-module data validation scripts, adjustment logs           |
| **Chandana**        | Testing pipeline integration, cron job verification             |
| **Vasudev**         | Password reset, token blacklisting, JWT refresh, logout         |
| **Sivadharneesh**   | E2E integration tests for Order/Stock/Billing flows             |

---

## License

ISC

---

> **Magilam Foods** — Crafted with care for catering excellence 🍛
