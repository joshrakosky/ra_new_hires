// Type definitions for Republic Airways New Hires Store

export interface Product {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
  thumbnail_url_black?: string // Color-specific thumbnail for black
  thumbnail_url_white?: string // Color-specific thumbnail for white
  color_thumbnails?: Record<string, string> // Flexible color-to-thumbnail mapping (JSONB)
  specs?: string
  category: 'tshirt' | 'kit' // Product category
  program: 'RA' | 'LIFT' // Which program this product belongs to
  requires_color: boolean
  requires_size: boolean
  available_colors?: string[]
  available_sizes?: string[] // Array of sizes (XS-4XL for t-shirts)
  customer_item_number?: string // SKU for backend tracking
  deco?: string // Decoration information
  inventory: number // Overall product inventory count
  inventory_by_size?: Record<string, number> // Track inventory by size: {"XS": 10, "S": 20, ...}
  created_at: string
}

export interface Order {
  id: string
  code: string // 6-letter access code
  email: string
  first_name: string
  last_name: string
  order_number: string
  program: 'RA' | 'LIFT' // Selected program
  tshirt_size?: string // Selected t-shirt size
  shipping_name: string
  shipping_attention?: string
  shipping_address: string
  shipping_address2?: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country: string
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  customer_item_number?: string // SKU for backend tracking
  color?: string
  size?: string
  created_at: string
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

