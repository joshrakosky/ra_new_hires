-- Republic Airways New Hires Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Products table for ra_new_hires
-- Tracks inventory by size (XS-4XL) and overall product inventory
CREATE TABLE IF NOT EXISTS ra_new_hire_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  thumbnail_url_black TEXT,
  thumbnail_url_white TEXT,
  color_thumbnails JSONB, -- Flexible color-to-thumbnail mapping
  specs TEXT,
  category TEXT NOT NULL, -- 'tshirt', 'kit', etc.
  program TEXT NOT NULL, -- 'RA' (Republic Airways) or 'LIFT' (LIFT Academy)
  requires_color BOOLEAN DEFAULT FALSE,
  requires_size BOOLEAN DEFAULT FALSE,
  available_colors TEXT[], -- Array of color options
  available_sizes TEXT[], -- Array of size options (XS, S, M, L, XL, 2XL, 3XL, 4XL)
  customer_item_number TEXT, -- SKU for backend tracking
  deco TEXT, -- Decoration information
  inventory INTEGER DEFAULT 0, -- Overall product inventory count
  inventory_by_size JSONB, -- Track inventory by size: {"XS": 10, "S": 20, "M": 30, ...}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table for ra_new_hires
-- One order per code (6 capital letters)
CREATE TABLE IF NOT EXISTS ra_new_hire_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- 6-letter code used to access the store
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  program TEXT NOT NULL, -- 'RA' or 'LIFT' - which program the user selected
  tshirt_size TEXT, -- Selected t-shirt size
  shipping_name TEXT NOT NULL DEFAULT 'Republic Airways Training Center',
  shipping_attention TEXT NOT NULL DEFAULT 'HR Shared Services',
  shipping_address TEXT NOT NULL DEFAULT '2 Brickyard Ln',
  shipping_address2 TEXT,
  shipping_city TEXT NOT NULL DEFAULT 'CARMEL',
  shipping_state TEXT NOT NULL DEFAULT 'IN',
  shipping_zip TEXT NOT NULL DEFAULT '46032',
  shipping_country TEXT DEFAULT 'USA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code) -- Prevent duplicate orders by code (one order per code)
);

-- Order items table for ra_new_hires
-- Tracks individual products in each order (t-shirt + kit items)
CREATE TABLE IF NOT EXISTS ra_new_hire_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES ra_new_hire_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ra_new_hire_products(id),
  product_name TEXT NOT NULL, -- Denormalized for easier export
  customer_item_number TEXT, -- SKU for backend tracking
  color TEXT,
  size TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_orders_code ON ra_new_hire_orders(code);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_orders_email ON ra_new_hire_orders(email);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_orders_order_number ON ra_new_hire_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_orders_program ON ra_new_hire_orders(program);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_order_items_order_id ON ra_new_hire_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_products_category ON ra_new_hire_products(category);
CREATE INDEX IF NOT EXISTS idx_ra_new_hire_products_program ON ra_new_hire_products(program);

-- Enable Row Level Security (RLS)
ALTER TABLE ra_new_hire_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_new_hire_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_new_hire_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for products (public read access)
CREATE POLICY "ra_new_hire_products are viewable by everyone"
  ON ra_new_hire_products FOR SELECT
  USING (true);

-- Policies for orders
CREATE POLICY "ra_new_hire_orders are insertable"
  ON ra_new_hire_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "ra_new_hire_orders are viewable by everyone" -- Admin will use service key
  ON ra_new_hire_orders FOR SELECT
  USING (true);

-- Policies for order_items
CREATE POLICY "ra_new_hire_order_items are insertable"
  ON ra_new_hire_order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "ra_new_hire_order_items are viewable by everyone"
  ON ra_new_hire_order_items FOR SELECT
  USING (true);

-- Note: Products should be added via Supabase dashboard or SQL
-- Example structure for inventory_by_size JSONB:
-- {"XS": 10, "S": 20, "M": 30, "L": 25, "XL": 20, "2XL": 15, "3XL": 10, "4XL": 5}

