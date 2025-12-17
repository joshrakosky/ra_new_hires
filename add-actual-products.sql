-- Add actual SYK EDT products to the database
-- Run this in Supabase SQL Editor

-- Clear any existing sample products (optional - comment out if you want to keep them)
-- DELETE FROM syk_edt_products WHERE name LIKE 'Sample%' OR name LIKE 'Test%';

-- Nike Men's Tech Fleece Full-Zip Hoodie
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('Nike Men''s Tech Fleece Full-Zip Hoodie', 'Comfortable tech fleece hoodie', 'product', true, true, 
 ARRAY['Anthracite Heather', 'Black', 'Dark Grey Heather'], 
 ARRAY['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
 'SYKEDT-AP-NKFQ4762');

-- Nike Women's Tech Fleece Full-Zip Hoodie
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('Nike Women''s Tech Fleece Full-Zip Hoodie', 'Comfortable tech fleece hoodie', 'product', true, true, 
 ARRAY['Anthracite Heather', 'Black', 'Dark Grey Heather'], 
 ARRAY['S', 'M', 'L', 'XL'],
 'SYKEDT-AP-NKFQ4798');

-- Moleskine Classic Vertical Device Bag
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('Moleskine Classic Vertical Device Bag', 'Professional device bag', 'product', true, false, 
 ARRAY['Black'], 
 NULL,
 'SYKEDT-BAG-MOLESKINE');

-- The North Face 35L Travel Backpack
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('The North Face 35L Travel Backpack', 'Spacious travel backpack', 'product', true, false, 
 ARRAY['TNF Black'], 
 NULL,
 'SYKEDT-BAG-TNF-35L');

-- TravisMathew Quad Carry-On Spinner
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('TravisMathew Quad Carry-On Spinner', 'Premium carry-on luggage', 'product', true, false, 
 ARRAY['Black', 'Graphite Heather'], 
 NULL,
 'SYKEDT-BAG-TRAVIS');

-- Zero Restriction Men's Quarter-Zip Pullover
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('Zero Restriction Men''s Quarter-Zip Pullover', 'Golf-inspired quarter-zip pullover', 'product', true, true, 
 ARRAY['Black'], 
 ARRAY['S', 'M', 'L', 'XL', '2XL', '3XL'],
 'SYKEDT-AP-ZERO-MEN');

-- Zero Restriction Women's Sofia Quarter-Zip Pullover
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('Zero Restriction Women''s Sofia Quarter-Zip Pullover', 'Golf-inspired quarter-zip pullover', 'product', true, true, 
 ARRAY['Black'], 
 ARRAY['XS', 'S', 'M', 'L', 'XL'],
 'SYKEDT-AP-ZERO-WOMEN');

-- IGLOO Trailmate 50QT Cooler
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('IGLOO Trailmate 50QT Cooler', 'Large capacity cooler', 'product', true, false, 
 ARRAY['Carbonite', 'Bone'], 
 NULL,
 'SYKEDT-KIT-IGLOO-50');

-- YETI Kit (Special handling - user gets all 3 sizes, chooses color)
-- This will be handled as a kit product that creates 3 order items
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes, customer_item_number) 
VALUES 
('YETI Kit', 'YETI Rambler Kit - Includes 8oz Cup, 26oz Bottle, and 35oz Tumbler', 'product', true, false, 
 ARRAY['Black', 'Navy', 'Cape Taupe', 'White'], 
 NULL,
 'SYKEDT-KIT-YETI-08');

-- Verify products were added
SELECT id, name, customer_item_number, requires_color, requires_size, available_colors, available_sizes 
FROM syk_edt_products 
ORDER BY name;

