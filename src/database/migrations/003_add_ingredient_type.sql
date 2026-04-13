-- Migration: Add item_type to ingredients table
-- Created by: Jai

ALTER TABLE ingredients 
ADD COLUMN item_type VARCHAR(20) DEFAULT 'food' CHECK (item_type IN ('food', 'consumable', 'service'));

-- Update existing items (if any) to 'food'
UPDATE ingredients SET item_type = 'food' WHERE item_type IS NULL;

-- Create index for faster filtering in ML/Stock logic
CREATE INDEX idx_ingredients_type ON ingredients(item_type);
