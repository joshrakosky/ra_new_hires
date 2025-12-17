-- Remove test/sample products from syk_edt_products table
-- Run this in Supabase SQL Editor

-- Delete products with test/sample names
DELETE FROM syk_edt_products 
WHERE name LIKE 'Sample%' 
   OR name LIKE 'Test%'
   OR name LIKE '%Test%'
   OR name LIKE '%Sample%';

-- Verify remaining products
SELECT id, name, customer_item_number 
FROM syk_edt_products 
ORDER BY name;

