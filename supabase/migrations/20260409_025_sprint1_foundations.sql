-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 1: Foundations — Claims, Reviews, Stock batch deduction, Waste audit
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Restaurant claim fields ──────────────────────────────────────────────
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT true;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Seeded (unclaimed) restaurants have claimed=false
-- When a restaurant owner claims, set claimed=true, claimed_by=user.id, claimed_at=now()

-- ── 2. Reviews table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  order_id    UUID REFERENCES orders(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  source      TEXT DEFAULT 'post_order' CHECK (source IN ('post_order', 'discovery', 'google_import')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);

-- Trigger: auto-update restaurant rating on review insert
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE restaurant_id = NEW.restaurant_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = NEW.restaurant_id)
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_rating ON reviews;
CREATE TRIGGER trg_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_auth_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 3. NPS responses table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  nps_type      TEXT NOT NULL CHECK (nps_type IN ('platform_customer', 'platform_admin', 'restaurant')),
  score         SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment       TEXT,
  context       JSONB DEFAULT '{}',  -- { page, order_id, session_duration, etc. }
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nps_type ON nps_responses(nps_type);
CREATE INDEX IF NOT EXISTS idx_nps_created ON nps_responses(created_at DESC);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nps_auth_insert" ON nps_responses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "nps_service_read" ON nps_responses FOR SELECT USING (true);

-- ── 4. Batch stock deduction function ───────────────────────────────────────
-- Replaces the N+1 loop in orders/route.ts PATCH handler
CREATE OR REPLACE FUNCTION deduct_order_stock(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_ingredient RECORD;
  v_deduction NUMERIC;
  v_results JSONB := '[]'::jsonb;
BEGIN
  -- Get order with restaurant_id
  SELECT id, restaurant_id INTO v_order
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order not found');
  END IF;

  -- Loop through order items
  FOR v_item IN
    SELECT oi.quantity, oi.menu_item_id, mi.ingredients
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = p_order_id
      AND mi.ingredients IS NOT NULL
  LOOP
    -- Loop through ingredients of each menu item
    FOR v_ingredient IN
      SELECT * FROM jsonb_array_elements(v_item.ingredients)
    LOOP
      v_deduction := (v_ingredient.value->>'qty')::numeric * v_item.quantity;

      -- Deduct stock (never below 0)
      UPDATE stock_items
      SET current_qty = GREATEST(0, current_qty - v_deduction),
          updated_at = now()
      WHERE id = (v_ingredient.value->>'stock_item_id')::uuid;

      -- Log movement
      INSERT INTO stock_movements (restaurant_id, stock_item_id, delta, reason, order_id)
      VALUES (
        v_order.restaurant_id,
        (v_ingredient.value->>'stock_item_id')::uuid,
        -v_deduction,
        'orden',
        p_order_id
      );

      v_results := v_results || jsonb_build_object(
        'stock_item_id', v_ingredient.value->>'stock_item_id',
        'deducted', v_deduction
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'deductions', v_results);
END;
$$ LANGUAGE plpgsql;

-- ── 5. Fix waste_log trigger to also log stock_movements ────────────────────
CREATE OR REPLACE FUNCTION handle_waste_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_stock RECORD;
BEGIN
  -- Get stock item info
  SELECT id, current_qty, cost_per_unit, restaurant_id
  INTO v_stock
  FROM stock_items WHERE id = NEW.stock_item_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Calculate cost
  NEW.cost_lost := NEW.qty_lost * v_stock.cost_per_unit;

  -- Deduct from stock
  UPDATE stock_items
  SET current_qty = GREATEST(0, current_qty - NEW.qty_lost),
      updated_at = now()
  WHERE id = NEW.stock_item_id;

  -- Log movement for audit trail
  INSERT INTO stock_movements (restaurant_id, stock_item_id, delta, reason)
  VALUES (v_stock.restaurant_id, NEW.stock_item_id, -NEW.qty_lost, 'merma');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 6. Support tickets table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id),
  user_id         UUID REFERENCES auth.users(id),
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  page_url        TEXT,
  screenshot_url  TEXT,
  severity        TEXT DEFAULT 'low' CHECK (severity IN ('critical', 'medium', 'low')),
  ai_analysis     JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'wont_fix')),
  resolution      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_severity ON support_tickets(severity);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_own_read" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "support_auth_insert" ON support_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 7. Restaurant claims table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_name      TEXT NOT NULL,
  owner_email     TEXT NOT NULL,
  owner_phone     TEXT,
  message         TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_restaurant ON restaurant_claims(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON restaurant_claims(status);

ALTER TABLE restaurant_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_public_insert" ON restaurant_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "claims_service_read" ON restaurant_claims FOR SELECT USING (true);
