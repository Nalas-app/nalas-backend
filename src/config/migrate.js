/**
 * Database Migration Script
 * Creates all Billing module tables
 */

require('dotenv').config();
const db = require('./database');

const migrate = async () => {
  console.log('🔄 Starting database migration...\n');
  
  try {
    // Create Users table (if not exists - depends on Auth module)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users table created');

    // Create Orders table (if not exists - depends on Orders module)
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES users(id),
        event_date DATE NOT NULL,
        event_time TIME,
        guest_count INTEGER NOT NULL,
        venue_address TEXT,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'quoted', 'confirmed', 'preparing', 'completed', 'cancelled')),
        total_amount DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ orders table created');

    // Create Order Items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id UUID,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2),
        total_price DECIMAL(12, 2),
        customizations JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ order_items table created');

    // Create Quotations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) UNIQUE,
        quotation_number VARCHAR(50) UNIQUE NOT NULL,
        subtotal DECIMAL(12, 2) NOT NULL,
        labor_cost DECIMAL(12, 2) DEFAULT 0,
        overhead_cost DECIMAL(12, 2) DEFAULT 0,
        discount DECIMAL(12, 2) DEFAULT 0,
        tax_amount DECIMAL(12, 2) DEFAULT 0,
        grand_total DECIMAL(12, 2) NOT NULL,
        valid_until DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ quotations table created');

    // Create Invoices table
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id),
        quotation_id UUID REFERENCES quotations(id),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        subtotal DECIMAL(12, 2) NOT NULL,
        labor_cost DECIMAL(12, 2),
        overhead_cost DECIMAL(12, 2),
        discount DECIMAL(12, 2) DEFAULT 0,
        tax_amount DECIMAL(12, 2),
        grand_total DECIMAL(12, 2) NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        paid_amount DECIMAL(12, 2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'refunded')),
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ invoices table created');

    // Create Payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID REFERENCES invoices(id),
        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'refund')),
        amount DECIMAL(12, 2) NOT NULL,
        transaction_id VARCHAR(100),
        payment_date DATE NOT NULL,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ payments table created');

    // Create Indexes for better query performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_quotations_order_id ON quotations(order_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
    `);
    console.log('✅ Indexes created');

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;
