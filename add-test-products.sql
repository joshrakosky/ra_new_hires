-- Add test products for SYK EDT
-- Run this in Supabase SQL Editor after tables are created

-- Simple product (no color/size)
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size) 
VALUES 
('Test Product Simple', 'A simple test product with no options', 'product', false, false);

-- Product with color only
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors) 
VALUES 
('Test Product with Color', 'A product with color options only', 'product', true, false, ARRAY['Black', 'White', 'Navy']);

-- Product with color and size
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes) 
VALUES 
('Test Product Full Options', 'A product with both color and size options', 'product', true, true, ARRAY['Black', 'White'], ARRAY['S', 'M', 'L', 'XL']);

-- Verify products were added
SELECT id, name, requires_color, requires_size, available_colors, available_sizes 
FROM syk_edt_products 
ORDER BY created_at DESC;

