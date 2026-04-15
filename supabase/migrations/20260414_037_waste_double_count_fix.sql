-- ── S24.6: Prevent double-counting of stock on merma-after-prep ────────────
-- When a confirmed/preparing/ready order is cancelled as merma, its stock has
-- already been deducted via deduct_order_stock. Logging waste_log would
-- deduct it a second time. We add an `already_deducted` flag so waste can be
-- recorded for audit without re-deducting.

ALTER TABLE waste_log
  ADD COLUMN IF NOT EXISTS already_deducted BOOLEAN NOT NULL DEFAULT false;

-- Relax the reason CHECK to include 'merma' and 'perdida' (used by cancel flow)
ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_reason_check;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_reason_check
  CHECK (reason IN ('vencimiento', 'deterioro', 'rotura', 'error_prep', 'sobras', 'otro', 'merma', 'perdida'));

-- Allow stock_item_id to be NULL for legacy free-form merma entries
ALTER TABLE waste_log ALTER COLUMN stock_item_id DROP NOT NULL;

-- Update trigger to respect the flag
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

  -- Calculate cost regardless (for reporting)
  IF NEW.cost_lost IS NULL OR NEW.cost_lost = 0 THEN
    NEW.cost_lost := NEW.qty_lost * v_stock.cost_per_unit;
  END IF;

  -- Skip stock mutation if it was already deducted elsewhere
  -- (e.g. order was confirmed/preparing before being marked as merma)
  IF NEW.already_deducted THEN
    RETURN NEW;
  END IF;

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
