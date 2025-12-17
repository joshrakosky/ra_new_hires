# SYK EDT Testing Guide

## Prerequisites

Before testing, ensure you have:
1. ✅ Supabase project created
2. ✅ Environment variables configured
3. ✅ Database schema executed
4. ✅ At least one test product added

## Step 1: Environment Setup

### Create `.env.local` file

Create a `.env.local` file in the root directory with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ADMIN_PASSWORD=stryker2024
```

**Where to find these:**
- Go to your Supabase project dashboard
- Settings → API
- Copy the "Project URL" and "anon public" key

### Install Dependencies

```bash
npm install
```

## Step 2: Database Setup

### Run the Schema

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Open `supabase-schema-syk-edt.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click "Run" to execute

**Verify tables were created:**
- Go to Table Editor
- You should see:
  - `syk_edt_products`
  - `syk_edt_orders`
  - `syk_edt_order_items`

### Add Test Products

Run this SQL in Supabase SQL Editor to add sample products:

```sql
-- Add a simple product (no color/size)
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size) 
VALUES 
('Test Product Simple', 'A simple test product', 'product', false, false);

-- Add a product with color only
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors) 
VALUES 
('Test Product with Color', 'A product with color options', 'product', true, false, ARRAY['Black', 'White', 'Navy']);

-- Add a product with color and size
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes) 
VALUES 
('Test Product Full', 'A product with color and size', 'product', true, true, ARRAY['Black', 'White'], ARRAY['S', 'M', 'L', 'XL']);
```

## Step 3: Start Development Server

```bash
npm run dev
```

The site should be available at: `http://localhost:3000`

## Step 4: Testing Checklist

### ✅ Test 1: Landing Page - Password Authentication

**URL:** `http://localhost:3000`

**Steps:**
1. Page should load with "Stryker Enterprise Digital and Technology" heading
2. Try entering wrong password → Should show error
3. Enter correct password: `sykedt25`
4. Click "Start Shopping →"

**Expected Result:**
- Should redirect to `/product` page

**❌ If it fails:**
- Check browser console for errors
- Verify password constant in `app/page.tsx` is `'sykedt25'`

---

### ✅ Test 2: Product Selection Page

**URL:** `http://localhost:3000/product`

**Steps:**
1. Should see "Select Your Product" heading
2. Dropdown should show your test products
3. Select a product
4. If product requires color, select a color
5. If product requires size, select a size
6. Click "Continue to Shipping →"

**Expected Result:**
- Should redirect to `/shipping` page
- Product selection stored in sessionStorage

**❌ If it fails:**
- Check browser console for errors
- Verify products exist in `syk_edt_products` table
- Check Supabase connection in browser console

---

### ✅ Test 3: Shipping Page - Email Collection

**URL:** `http://localhost:3000/shipping`

**Steps:**
1. Should see "Shipping Information" heading
2. Fill in all required fields:
   - Email address (e.g., `test@example.com`)
   - Full Name
   - Street Address
   - City
   - State
   - ZIP Code
3. Click "Continue to Review →"

**Expected Result:**
- Should redirect to `/review` page
- Email stored in sessionStorage as `orderEmail`
- Shipping info stored in sessionStorage

**❌ If it fails:**
- Check that all required fields are filled
- Verify form validation is working

---

### ✅ Test 4: Review Page

**URL:** `http://localhost:3000/review`

**Steps:**
1. Should see "Review Your Order" heading
2. Verify "Selected Product" section shows:
   - Product name
   - Color (if applicable)
   - Size (if applicable)
3. Verify "Shipping Information" section shows:
   - Email address
   - Full name
   - Complete address
4. Click "Submit Order →"

**Expected Result:**
- Should show "Submitting..." on button
- Should redirect to `/confirmation` page
- Order created in database

**❌ If it fails:**
- Check browser console for API errors
- Verify Supabase connection
- Check that order was created in `syk_edt_orders` table

---

### ✅ Test 5: Confirmation Page

**URL:** `http://localhost:3000/confirmation`

**Steps:**
1. Should see "Order Confirmed!" message
2. Should display order number in format `sykedt-001`
3. Order number should be highlighted in yellow/gold

**Expected Result:**
- Order number displayed correctly
- Can click "Email Order Confirmation" button

**Verify in Database:**
1. Go to Supabase → Table Editor → `syk_edt_orders`
2. Should see your order with:
   - Order number: `sykedt-001`
   - Email: the email you entered
   - Shipping information
3. Go to `syk_edt_order_items`
4. Should see one item with your product details

**❌ If it fails:**
- Check that order was created in database
- Verify order number format matches `sykedt-XXX`

---

### ✅ Test 6: Duplicate Email Prevention

**Steps:**
1. Try to place another order with the SAME email address
2. Go through the full flow again with same email
3. On review page, click "Submit Order →"

**Expected Result:**
- Should show error: "An order already exists for this email address. Only one order per email is allowed."
- Order should NOT be created

**Verify in Database:**
- Only ONE order should exist for that email in `syk_edt_orders`

**❌ If it fails:**
- Check API route error handling
- Verify database UNIQUE constraint on email column

---

### ✅ Test 7: Admin Page

**URL:** `http://localhost:3000/admin`

**Steps:**
1. Should see password prompt
2. Enter admin password (default: `stryker2024` or from `.env.local`)
3. Should see "SYK EDT Order Management" heading
4. Should see your test order(s) in the table
5. Click "Export to Excel" button

**Expected Result:**
- Should download Excel file
- File should have two sheets:
  - "Detailed Orders" - one row per item
  - "Distribution Summary" - grouped by product/color/size

**Verify Excel Export:**
- Open the downloaded Excel file
- Check that order details are correct
- Verify all columns are populated

**❌ If it fails:**
- Check admin password in `.env.local`
- Verify orders exist in `syk_edt_orders` table
- Check browser console for errors

---

### ✅ Test 8: Navigation Flow

**Test going back and forth:**

1. Landing → Product → Shipping → Review
2. From Review, click "← Back" → Should go to Shipping
3. From Shipping, click "← Back" → Should go to Product
4. From Product, click "← Back" → Should go to Landing

**Expected Result:**
- All navigation should work smoothly
- Data should persist when going back

---

## Step 5: Database Verification

### Check Tables

Run these queries in Supabase SQL Editor:

```sql
-- Check products
SELECT * FROM syk_edt_products;

-- Check orders
SELECT * FROM syk_edt_orders ORDER BY created_at DESC;

-- Check order items
SELECT * FROM syk_edt_order_items;

-- Check order with items (join)
SELECT 
  o.order_number,
  o.email,
  o.shipping_name,
  oi.product_name,
  oi.color,
  oi.size
FROM syk_edt_orders o
LEFT JOIN syk_edt_order_items oi ON o.id = oi.order_id
ORDER BY o.created_at DESC;
```

---

## Step 6: Common Issues & Solutions

### Issue: "Failed to load products"
**Solution:**
- Check Supabase connection
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Check that products exist in `syk_edt_products` table
- Verify RLS policies allow SELECT

### Issue: "Failed to create order"
**Solution:**
- Check browser console for specific error
- Verify all required fields are filled
- Check that email is unique (if duplicate error)
- Verify RLS policies allow INSERT

### Issue: "Password not working"
**Solution:**
- Verify password in `app/page.tsx` is exactly `'sykedt25'`
- Check for typos
- Clear browser cache and try again

### Issue: "Admin page not loading orders"
**Solution:**
- Check admin password in `.env.local`
- Verify orders exist in `syk_edt_orders` table
- Check RLS policies allow SELECT

---

## Step 7: Production Readiness Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] Real products added to database
- [ ] Password changed from default (if needed)
- [ ] Admin password set in environment variables
- [ ] Environment variables configured in hosting platform
- [ ] Database backup configured
- [ ] Test order flow with real email addresses
- [ ] Verify Excel export works correctly
- [ ] Check mobile responsiveness
- [ ] Test with different browsers

---

## Quick Test Script

For quick verification, you can run this in Supabase SQL Editor after placing a test order:

```sql
-- Quick verification query
SELECT 
  o.order_number,
  o.email,
  o.shipping_name,
  o.created_at,
  COUNT(oi.id) as item_count
FROM syk_edt_orders o
LEFT JOIN syk_edt_order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.email, o.shipping_name, o.created_at
ORDER BY o.created_at DESC
LIMIT 5;
```

This shows the 5 most recent orders with item counts.

