-- ── S24.10: Stock expiry tracking ────────────────────────────────────────
-- Allow each stock_item to have an expiry_date and a per-category default
-- shelf_life_days. Chapi reads these to suggest which products to cook first.

ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS expiry_date        DATE,
  ADD COLUMN IF NOT EXISTS shelf_life_days    INTEGER,
  ADD COLUMN IF NOT EXISTS last_restocked_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS stock_expiry_idx
  ON stock_items (restaurant_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

COMMENT ON COLUMN stock_items.expiry_date IS
  'Earliest expiry for this stock lot. Items expiring in <= 3 days are surfaced as priority cook by Chapi.';
COMMENT ON COLUMN stock_items.shelf_life_days IS
  'Default shelf life by product (days since last restock). Used to auto-compute expiry when not set.';
