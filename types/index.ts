// Type definitions for the Stryker Christmas Store

export interface Product {
  id: string
  name: string
  description: string
  thumbnail_url?: string
  thumbnail_url_black?: string // Color-specific thumbnail for black
  thumbnail_url_white?: string // Color-specific thumbnail for white
  color_thumbnails?: Record<string, string> // Flexible color-to-thumbnail mapping (JSONB)
  specs?: string
  category: 'choice1' | 'choice2' // Which product choice this belongs to
  requires_color: boolean
  requires_size: boolean
  available_colors?: string[]
  available_sizes?: string[]
  customer_item_number?: string // SKU for backend tracking
  // Multiple items support (for kits with polo + cap/beanie, tile + cap/beanie, airtag + cap/beanie)
  has_multiple_items?: boolean
  polo_colors?: string[]
  polo_sizes?: string[]
  cap_colors?: string[]
  cap_sizes?: string[]
  beanie_colors?: string[]
  polo_thumbnails?: Record<string, string> // JSONB mapping color to thumbnail
  cap_thumbnails?: Record<string, string> // JSONB mapping color to thumbnail
  beanie_thumbnails?: Record<string, string> // JSONB mapping color to thumbnail
  created_at: string
}

export interface Order {
  id: string
  email: string
  order_number: string
  shipping_name: string
  shipping_address: string
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

