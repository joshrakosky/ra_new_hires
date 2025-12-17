-- Fix Nike Women's Tech Fleece Full-Zip Hoodie item number
-- Update from 102663 to NKFQ4798

UPDATE syk_edt_products
SET customer_item_number = 'SYKEDT-AP-NKFQ4798'
WHERE name = 'Nike Women''s Tech Fleece Full-Zip Hoodie'
AND customer_item_number = 'SYKEDT-AP-102663';

-- Verify the update
SELECT id, name, customer_item_number 
FROM syk_edt_products 
WHERE name LIKE '%Women%Tech Fleece%';

