-- Migration: 003_add_ingredient_category.sql
-- Description: Add category column to ingredients for better organization
-- Author: Jai (Backend Lead) / Antigravity
-- Date: 2026-04-14

-- Add category column
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Index the category column for performance
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
