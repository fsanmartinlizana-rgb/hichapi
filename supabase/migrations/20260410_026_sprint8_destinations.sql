-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 8: Comandas Destinations + Auto Stock Deduction
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   • menu_items.destination (cocina | barra | ninguno) — routing for prep stations
--   • order_items.destination (denormalized snapshot at order time)
--   • Index for fast filtering by station
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Destination on menu_items ────────────────────────────────────────────
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT 'cocina'
  CHECK (destination IN ('cocina', 'barra', 'ninguno'));

CREATE INDEX IF NOT EXISTS idx_menu_items_destination
  ON menu_items(restaurant_id, destination);

COMMENT ON COLUMN menu_items.destination IS
  'Where this item is prepared. Used to route comandas to kitchen vs bar stations. ninguno = no prep needed (e.g., bottled drinks).';

-- ── 2. Destination snapshot on order_items ──────────────────────────────────
-- Denormalized at insert time so historical orders aren't affected by menu edits
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT 'cocina'
  CHECK (destination IN ('cocina', 'barra', 'ninguno'));

CREATE INDEX IF NOT EXISTS idx_order_items_destination
  ON order_items(order_id, destination);

-- ── 3. Backfill destination on existing order_items from current menu ───────
UPDATE order_items oi
SET destination = mi.destination
FROM menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.destination = 'cocina'
  AND mi.destination IS NOT NULL;

-- ── 4. Per-station status on order_items ────────────────────────────────────
-- Lets each station mark its items as 'ready' independently.
-- Order is fully ready when ALL non-'ninguno' items have station_status='ready'.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS station_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (station_status IN ('pending', 'preparing', 'ready'));

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS station_ready_at TIMESTAMPTZ;

-- ── 5. Helper RPC: mark station-side ready, advance order if all done ───────
CREATE OR REPLACE FUNCTION mark_station_ready(
  p_order_id UUID,
  p_destination TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_count INT;
  v_total_count INT;
  v_new_order_status TEXT;
BEGIN
  -- Mark all items of this destination as ready
  UPDATE order_items
  SET station_status = 'ready',
      station_ready_at = now()
  WHERE order_id = p_order_id
    AND destination = p_destination
    AND station_status <> 'ready';

  -- Count remaining pending items (excluding 'ninguno' which need no prep)
  SELECT
    COUNT(*) FILTER (WHERE station_status <> 'ready' AND destination <> 'ninguno'),
    COUNT(*)
  INTO v_pending_count, v_total_count
  FROM order_items
  WHERE order_id = p_order_id;

  -- Decide new order status
  IF v_pending_count = 0 THEN
    v_new_order_status := 'ready';
  ELSE
    v_new_order_status := 'partial_ready';
  END IF;

  -- Update order header
  UPDATE orders
  SET status = v_new_order_status
  WHERE id = p_order_id
    AND status NOT IN ('paid', 'cancelled');

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'destination', p_destination,
    'pending_remaining', v_pending_count,
    'order_status', v_new_order_status
  );
END;
$$;

COMMENT ON FUNCTION mark_station_ready IS
  'Marks all items of a destination as ready, then promotes order to partial_ready or ready accordingly.';

-- ── 6. Allow partial_ready in orders.status check ───────────────────────────
-- Ensure orders.status accepts the new partial_ready value
DO $$
BEGIN
  -- Drop existing constraint if any
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;

  -- Recreate with partial_ready added
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending', 'confirmed', 'preparing', 'partial_ready',
      'ready', 'paying', 'paid', 'cancelled'
    ));
END $$;
