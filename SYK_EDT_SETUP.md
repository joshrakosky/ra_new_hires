# Stryker Enterprise Digital and Technology (SYK EDT) Ecommerce Setup

## Overview
This is a simplified version of the ecommerce site specifically for Stryker Enterprise Digital and Technology. It features:
- Password-based site access (no email approval list)
- Single product selection (instead of choice1/choice2)
- Email collection during shipping
- One order per email enforcement
- Separate database tables for SYK EDT

## Database Setup

### 1. Run the SQL Schema
Execute the SQL file `supabase-schema-syk-edt.sql` in your Supabase SQL Editor to create:
- `syk_edt_products` - Product catalog
- `syk_edt_orders` - Order information (with email uniqueness constraint)
- `syk_edt_order_items` - Individual items in each order

### 2. Add Your Products
Add products to the `syk_edt_products` table via Supabase dashboard or SQL. Products should have:
- `name`: Product name
- `description`: Product description (optional)
- `category`: Default to 'product' (single category)
- `requires_color`: boolean
- `requires_size`: boolean
- `available_colors`: array of strings (if requires_color is true)
- `available_sizes`: array of strings (if requires_size is true)
- `thumbnail_url`: Main product image
- `thumbnail_url_black`: Black color variant image (optional)
- `thumbnail_url_white`: White color variant image (optional)
- `color_thumbnails`: JSONB object mapping colors to image URLs (optional, most flexible)
- `customer_item_number`: SKU for backend tracking (optional)
- `deco`: Decoration information (optional)

## Site Access

**Password**: `sykedt25`

Users enter this password on the landing page to access the site. No email approval list is needed.

## Order Flow

1. **Landing Page** (`/`): User enters password (sykedt25)
2. **Product Selection** (`/product`): User selects one product with color/size options if applicable
3. **Shipping** (`/shipping`): User enters email and shipping information
4. **Review** (`/review`): User reviews order before submission
5. **Confirmation** (`/confirmation`): Order confirmation with order number

## Order Number Format

Orders are numbered as: `sykedt-001`, `sykedt-002`, etc.

## Key Features

### One Order Per Email
The system enforces one order per email address. If a user tries to place a second order with the same email, they will receive an error message.

### Email Collection
Email is collected on the shipping page and stored with the order. This is used for:
- Duplicate order prevention
- Order tracking
- Export functionality

### Admin Access
Visit `/admin` to:
- View all orders
- Export orders to Excel (two sheets: Detailed Orders and Distribution Summary)

## File Structure

### New/Modified Files
- `app/page.tsx` - Landing page with password authentication
- `app/product/page.tsx` - Single product selection page
- `app/shipping/page.tsx` - Shipping form with email field
- `app/review/page.tsx` - Review page for single product
- `app/api/orders/route.ts` - Order API using syk_edt tables
- `app/admin/page.tsx` - Admin page using syk_edt tables
- `supabase-schema-syk-edt.sql` - Database schema

### Unused Files (from original)
- `app/choice1/page.tsx` - Not used (replaced by `/product`)
- `app/choice2/page.tsx` - Not used (replaced by `/product`)
- `lib/approvedEmails.ts` - Not used (password auth instead)

## Testing Checklist

1. ✅ Password authentication works (sykedt25)
2. ✅ Product selection page loads products from `syk_edt_products`
3. ✅ Shipping page collects email and address
4. ✅ Review page shows selected product and shipping info
5. ✅ Order submission creates order in `syk_edt_orders`
6. ✅ Duplicate email prevention works
7. ✅ Order numbers follow sykedt-XXX format
8. ✅ Admin page loads orders from syk_edt tables
9. ✅ Excel export works correctly

## Next Steps

1. Run the SQL schema in Supabase
2. Add your actual products to `syk_edt_products` table
3. Test the full order flow
4. Update branding/text as needed
5. Deploy to production

## Notes

- The original `christmas_products`, `christmas_orders`, and `christmas_order_items` tables remain untouched
- This is a separate implementation that can coexist with the original site
- All SYK EDT data is isolated in its own tables

