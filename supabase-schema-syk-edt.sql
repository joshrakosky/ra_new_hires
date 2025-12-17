-- Stryker Enterprise Digital and Technology (syk_edt) Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Products table for syk_edt
CREATE TABLE IF NOT EXISTS syk_edt_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  thumbnail_url_black TEXT,
  thumbnail_url_white TEXT,
  color_thumbnails JSONB, -- Flexible color-to-thumbnail mapping
  specs TEXT,
  category TEXT NOT NULL DEFAULT 'product', -- Single category since only one product selection
  requires_color BOOLEAN DEFAULT FALSE,
  requires_size BOOLEAN DEFAULT FALSE,
  available_colors TEXT[], -- Array of color options
  available_sizes TEXT[], -- Array of size options
  customer_item_number TEXT, -- SKU for backend tracking
  deco TEXT, -- Decoration information
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table for syk_edt
CREATE TABLE IF NOT EXISTS syk_edt_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  shipping_name TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_address2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  shipping_country TEXT DEFAULT 'USA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email) -- Prevent duplicate orders by email (one order per email)
);

-- Order items table for syk_edt
CREATE TABLE IF NOT EXISTS syk_edt_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES syk_edt_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES syk_edt_products(id),
  product_name TEXT NOT NULL, -- Denormalized for easier export
  customer_item_number TEXT, -- SKU for backend tracking
  color TEXT,
  size TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_syk_edt_orders_email ON syk_edt_orders(email);
CREATE INDEX IF NOT EXISTS idx_syk_edt_orders_order_number ON syk_edt_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_syk_edt_order_items_order_id ON syk_edt_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_syk_edt_products_category ON syk_edt_products(category);

-- Enable Row Level Security (RLS)
ALTER TABLE syk_edt_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE syk_edt_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE syk_edt_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for products (public read access)
CREATE POLICY "syk_edt_products are viewable by everyone"
  ON syk_edt_products FOR SELECT
  USING (true);

-- Policies for orders
CREATE POLICY "syk_edt_orders are insertable"
  ON syk_edt_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "syk_edt_orders are viewable by everyone" -- Admin will use service key
  ON syk_edt_orders FOR SELECT
  USING (true);

-- Policies for order_items
CREATE POLICY "syk_edt_order_items are insertable"
  ON syk_edt_order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "syk_edt_order_items are viewable by everyone"
  ON syk_edt_order_items FOR SELECT
  USING (true);

-- Products should be added via add-actual-products.sql or Supabase dashboard

