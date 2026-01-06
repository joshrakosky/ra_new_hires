-- Add DELETE policies for orders and UPDATE policies for products
-- Run this SQL in your Supabase SQL Editor
-- This allows admin to cancel orders and update inventory

-- Allow DELETE on orders (for order cancellation)
CREATE POLICY "ra_new_hire_orders are deletable"
  ON ra_new_hire_orders FOR DELETE
  USING (true);

-- Allow UPDATE on products (for inventory restoration)
CREATE POLICY "ra_new_hire_products are updatable"
  ON ra_new_hire_products FOR UPDATE
  USING (true);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('ra_new_hire_orders', 'ra_new_hire_products')
ORDER BY tablename, policyname;

