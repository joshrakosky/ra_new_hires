-- Add UPDATE policy for orders table
-- This allows updating order status and other fields
-- Run this SQL in your Supabase SQL Editor

CREATE POLICY "ra_new_hire_orders are updatable"
  ON ra_new_hire_orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Verify policy was created
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
WHERE tablename = 'ra_new_hire_orders'
ORDER BY policyname;
