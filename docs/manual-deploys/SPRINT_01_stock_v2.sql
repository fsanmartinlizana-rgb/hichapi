-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 1.1 — Stock v2: lot_number + alert_days_before
-- Idempotente. Pegar en Supabase SQL Editor y correr.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS lot_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS alert_days_before INTEGER NOT NULL DEFAULT 3
    CHECK (alert_days_before >= 0 AND alert_days_before <= 90);

COMMENT ON COLUMN stock_items.lot_number IS 'Numero de lote para FIFO simple. Para FIFO granular usar tabla stock_batches (Sprint 2).';
COMMENT ON COLUMN stock_items.alert_days_before IS 'Dias antes del vencimiento que Chapi alerta. Default 3.';

-- Index por (restaurant_id, expiry_date) para queries de "productos por vencer"
CREATE INDEX IF NOT EXISTS idx_stock_items_expiry
  ON stock_items (restaurant_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

-- ── Verificación (opcional) ──────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_items'
  AND column_name IN ('lot_number', 'alert_days_before', 'expiry_date');
