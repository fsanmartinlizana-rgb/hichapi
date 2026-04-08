-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015: Stock items + waste log
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. stock_items: inventario base del restaurante
CREATE TABLE IF NOT EXISTS public.stock_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kg'
                    CHECK (unit IN ('kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja')),
  current_qty     NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
  min_qty         NUMERIC(10,3) NOT NULL DEFAULT 0,
  cost_per_unit   INTEGER NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0), -- CLP
  supplier        TEXT,
  category        TEXT DEFAULT 'general',
  active          BOOLEAN DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_restaurant_idx ON public.stock_items (restaurant_id);
CREATE INDEX IF NOT EXISTS stock_low_qty_idx    ON public.stock_items (restaurant_id, current_qty, min_qty);

-- 2. waste_log: registro de mermas
CREATE TABLE IF NOT EXISTS public.waste_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stock_item_id   UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty_lost        NUMERIC(10,3) NOT NULL CHECK (qty_lost > 0),
  reason          TEXT NOT NULL
                    CHECK (reason IN ('vencimiento', 'deterioro', 'rotura', 'error_prep', 'sobras', 'otro')),
  notes           TEXT,
  logged_by       UUID REFERENCES auth.users(id),
  cost_lost       INTEGER GENERATED ALWAYS AS (NULL) STORED, -- computed in app layer
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Override: make cost_lost a regular column so we can store computed value
ALTER TABLE public.waste_log DROP COLUMN IF EXISTS cost_lost;
ALTER TABLE public.waste_log ADD COLUMN cost_lost INTEGER DEFAULT 0; -- filled by trigger

CREATE INDEX IF NOT EXISTS waste_restaurant_idx ON public.waste_log (restaurant_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS waste_item_idx       ON public.waste_log (stock_item_id);

-- 3. Trigger: compute cost_lost + deduct from stock_items on waste insert
CREATE OR REPLACE FUNCTION public.handle_waste_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  -- Get cost per unit of the stock item
  SELECT cost_per_unit INTO v_cost
  FROM public.stock_items WHERE id = NEW.stock_item_id;

  -- Compute cost lost
  NEW.cost_lost := ROUND(NEW.qty_lost * v_cost);

  -- Deduct from stock
  UPDATE public.stock_items
  SET current_qty = GREATEST(0, current_qty - NEW.qty_lost),
      updated_at  = now()
  WHERE id = NEW.stock_item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waste_insert_trigger ON public.waste_log;
CREATE TRIGGER waste_insert_trigger
  BEFORE INSERT ON public.waste_log
  FOR EACH ROW EXECUTE FUNCTION public.handle_waste_insert();

-- 4. stock_movements: historial de ajustes manuales
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  delta         NUMERIC(10,3) NOT NULL, -- positive = add, negative = deduct
  reason        TEXT NOT NULL DEFAULT 'ajuste_manual'
                  CHECK (reason IN ('compra', 'ajuste_manual', 'orden', 'devolucion', 'merma')),
  order_id      UUID REFERENCES orders(id),
  logged_by     UUID REFERENCES auth.users(id),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movement_item_idx ON public.stock_movements (stock_item_id, logged_at DESC);

-- 5. Add ingredients[] JSON to menu_items (for stock deduction on orders)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS ingredients JSONB DEFAULT '[]';
-- Format: [{ "stock_item_id": "uuid", "qty": 0.1 }, ...]

-- 6. RLS

ALTER TABLE public.stock_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements  ENABLE ROW LEVEL SECURITY;

-- Stock items: staff can read, admin can manage
CREATE POLICY "staff_read_stock" ON public.stock_items
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

CREATE POLICY "admin_manage_stock" ON public.stock_items
  FOR ALL USING (
    public.is_super_admin()
    OR (
      restaurant_id = public.my_restaurant_id()
      AND public.my_role_for(restaurant_id) IN ('owner', 'admin', 'supervisor')
    )
  );

-- Waste log: staff can insert, admin can read/delete
CREATE POLICY "staff_insert_waste" ON public.waste_log
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

CREATE POLICY "staff_read_waste" ON public.waste_log
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

CREATE POLICY "admin_delete_waste" ON public.waste_log
  FOR DELETE USING (
    public.is_super_admin()
    OR public.is_admin_for(restaurant_id)
  );

-- Stock movements: staff can read, server inserts via service role
CREATE POLICY "staff_read_movements" ON public.stock_movements
  FOR SELECT USING (
    public.is_super_admin()
    OR restaurant_id = public.my_restaurant_id()
  );

-- 7. Realtime for stock (low-stock alerts in panel)
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_log;
