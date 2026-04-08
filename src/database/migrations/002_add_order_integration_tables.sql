-- Migration: 002_add_order_integration_tables.sql
-- Description: Add tables for order status history and stock reservations
-- Author: Jai (Backend Lead)
-- Date: 2026-02-25

-- Order status history for audit trail
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_changed_at ON order_status_history(changed_at);

-- Stock reservations linked to orders (for rollback on cancellation)
CREATE TABLE IF NOT EXISTS order_stock_reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    reserved_quantity DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, ingredient_id)
);

CREATE INDEX idx_order_stock_reservations_order_id ON order_stock_reservations(order_id);
