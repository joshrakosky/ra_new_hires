-- Quick verification query to check if SYK EDT tables exist
-- Run this in Supabase SQL Editor after applying the migration

-- Check if tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('syk_edt_products', 'syk_edt_orders', 'syk_edt_order_items')
ORDER BY table_name;

-- If tables exist, show their structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('syk_edt_products', 'syk_edt_orders', 'syk_edt_order_items')
ORDER BY table_name, ordinal_position;

