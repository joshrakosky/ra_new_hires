# Stryker Enterprise Digital and Technology (SYK EDT) Ecommerce Site

A simplified ecommerce site for Stryker Enterprise Digital and Technology product selection. Users enter a password to access the site, select a product, provide shipping information, and receive an order confirmation.

## Features

- **Password-Based Access**: Simple password entry (no email approval list)
- **Single Product Selection**: One product selection page with color/size options
- **Email Collection**: Email collected during shipping for order tracking
- **One Order Per Email**: Database-enforced limit of one order per email address
- **Admin Dashboard**: View and export orders to Excel

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema-syk-edt.sql` in your Supabase SQL Editor
3. Add your Supabase credentials to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ADMIN_PASSWORD` (optional, defaults to 'stryker2024')

### 3. Add Products

Add your products to the `syk_edt_products` table via Supabase dashboard or SQL. See `SYK_EDT_SETUP.md` for detailed product schema.

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Site Access

**Password**: `sykedt25`

Users enter this password on the landing page to access the site.

## Order Flow

1. **Landing Page** (`/`): User enters password
2. **Product Selection** (`/product`): User selects one product with options
3. **Shipping** (`/shipping`): User enters email and shipping information
4. **Review** (`/review`): User reviews order before submission
5. **Confirmation** (`/confirmation`): Order confirmation with order number

## Order Number Format

Orders are numbered as: `sykedt-001`, `sykedt-002`, etc.

## Admin Access

Visit `/admin` to:
- View all orders
- Export orders to Excel (two sheets: Detailed Orders and Distribution Summary)

## Database Schema

- **syk_edt_products**: Product catalog
- **syk_edt_orders**: Order information (with email uniqueness constraint)
- **syk_edt_order_items**: Individual items in each order

See `supabase-schema-syk-edt.sql` for the complete schema.

## Documentation

- `SYK_EDT_SETUP.md` - Detailed setup guide
- `IMPLEMENTATION_SUMMARY.md` - Implementation details and replication guide

## Deployment

Deploy to Vercel:

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

