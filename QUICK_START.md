# Quick Start Guide - SYK EDT

## 🚀 Get Running in 5 Minutes

### 1. Environment Setup (2 min)

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_ADMIN_PASSWORD=stryker2024
```

**Get these from:** Supabase Dashboard → Settings → API

### 2. Install & Run (1 min)

```bash
npm install
npm run dev
```

Visit: `http://localhost:3000`

### 3. Database Setup (2 min)

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase-schema-syk-edt.sql`
3. Paste and click "Run"
4. Add a test product:

```sql
INSERT INTO syk_edt_products (name, description, category, requires_color, requires_size, available_colors, available_sizes) 
VALUES 
('Test Product', 'A test product', 'product', true, true, ARRAY['Black', 'White'], ARRAY['S', 'M', 'L']);
```

### 4. Test the Flow

1. Go to `http://localhost:3000`
2. Enter password: `sykedt25`
3. Select product → Choose color/size
4. Enter shipping info (include email)
5. Review and submit
6. See confirmation with order number

### 5. Verify in Database

Supabase → Table Editor → `syk_edt_orders` → Should see your order!

---

## 📋 Full Testing

See `TESTING_GUIDE.md` for comprehensive testing steps.

---

## 🔧 Troubleshooting

**Products not loading?**
- Check `.env.local` has correct Supabase credentials
- Verify products exist in `syk_edt_products` table

**Order not submitting?**
- Check browser console for errors
- Verify all required fields are filled
- Check email is unique (one order per email)

**Admin page not working?**
- Check `NEXT_PUBLIC_ADMIN_PASSWORD` in `.env.local`
- Default password: `stryker2024`

