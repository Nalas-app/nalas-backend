# Billing & Payments Module

This is the Billing & Payments module for the Catering Management System. It's built with Node.js, Express.js, and PostgreSQL.

## Project Structure

```
payment_nalas/
├── src/
│   ├── config/
│   │   ├── app.js           # Application configuration
│   │   ├── database.js     # Database connection
│   │   └── migrate.js       # Database migration script
│   ├── controllers/
│   │   └── billingController.js  # Request handlers
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   ├── errorHandler.js # Error handling
│   │   └── validation.js   # Request validation
│   ├── models/
│   │   └── billingModels.js # Database queries
│   ├── routes/
│   │   └── billingRoutes.js  # API routes
│   ├── validation/
│   │   └── schemas.js       # Joi validation schemas
│   └── index.js            # Entry point
├── tests/
│   └── billing.test.js     # Unit tests
├── .env.example            # Environment variables template
├── package.json
└── TODO.md                 # Implementation plan

## API Endpoints

### Quotations
- `POST /billing/quotations` - Create quotation
- `GET /billing/quotations/:id` - Get quotation by ID
- `GET /billing/quotations/order/:orderId` - Get quotation by order
- `GET /billing/quotations/validate/:orderId` - Validate quotation

### Invoices
- `POST /billing/invoices` - Create invoice
- `GET /billing/invoices/:id` - Get invoice by ID
- `GET /billing/invoices/order/:orderId` - Get invoice by order
- `POST /billing/invoices/mark-overdue` - Mark overdue invoices (admin)

### Payments
- `POST /billing/payments` - Record payment (admin)
- `GET /billing/payments` - List all payments (admin)
- `GET /billing/payments/invoice/:invoiceId` - Get payments by invoice
- `POST /billing/payments/refund` - Record refund (admin)

### Reports
- `GET /billing/reports/revenue` - Revenue report (admin)

## Setup Instructions

### 1. Install Dependencies
```
bash
npm install
```

### 2. Configure Environment Variables
Copy the .env.example file to .env and update the database credentials:
```
bash
cp .env.example .env
```

Edit `.env` file with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=billing_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Create Database
Create a new PostgreSQL database:
```
sql
CREATE DATABASE billing_db;
```

### 4. Run Migration
Create the required tables:
```
bash
npm run migrate
```

### 5. Start the Server
```
bash
# Development
npm run dev

# Production
npm start
```

The server will run on http://localhost:3000

## Testing
```
bash
npm test
```

## Dependencies

- **express** - Web framework
- **pg** - PostgreSQL driver
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **joi** - Input validation
- **uuid** - UUID generation
- **dotenv** - Environment variables

## Next Steps

1. Set up PostgreSQL and configure .env
2. Run the migration script
3. Start the server and test the endpoints
4. Integrate with other modules (Orders, Stock)

## Error Codes

- `BILLING_001` - Order not found
- `BILLING_002` - Quotation number generation failed
- `BILLING_003` - PDF generation failed
- `BILLING_004` - Order not confirmed
- `BILLING_005` - Invoice already exists
- `BILLING_006` - Invoice not found
- `BILLING_007` - Overpayment attempt
- `BILLING_008` - Invalid payment method
