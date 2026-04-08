-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013: orders, order_items + qr_token on tables
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add qr_token to tables (unique short token for QR codes)
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Back-fill existing rows that got NULL (shouldn't happen due to DEFAULT, but just in case)
UPDATE public.tables SET qr_token = gen_random_uuid()::text WHERE qr_token IS NULL;

-- 2. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id      UUID NOT NULL REFERENCES tables(id),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','preparing','ready','paying','paid','cancelled')),
  total         INTEGER NOT NULL DEFAULT 0,
  client_name   TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Order items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   INTEGER NOT NULL CHECK (unit_price >= 0),
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','preparing','ready','cancelled'))
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS orders_restaurant_idx  ON public.orders (restaurant_id);
CREATE INDEX IF NOT EXISTS orders_table_idx       ON public.orders (table_id);
CREATE INDEX IF NOT EXISTS orders_status_idx      ON public.orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS orders_created_idx     ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_idx  ON public.order_items (order_id);

-- 5. Auto-update updated_at on orders
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anonymous clients (QR table scan) can INSERT orders
CREATE POLICY "public_insert_order" ON public.orders
  FOR INSERT WITH CHECK (true);

-- Anyone can read orders (needed for realtime on garzón + table client)
CREATE POLICY "public_read_order" ON public.orders
  FOR SELECT USING (true);

-- Anonymous clients can INSERT items
CREATE POLICY "public_insert_order_items" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- Anyone can read order items
CREATE POLICY "public_read_order_items" ON public.order_items
  FOR SELECT USING (true);

-- Restaurant owner can UPDATE/DELETE their orders (e.g. garzón advancing status)
CREATE POLICY "owner_manage_orders" ON public.orders
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Owner can manage order items
CREATE POLICY "owner_manage_order_items" ON public.order_items
  FOR ALL USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      WHERE r.owner_id = auth.uid()
    )
  );

-- 7. Realtime (enable on both tables)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
