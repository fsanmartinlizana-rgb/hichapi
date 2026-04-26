-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 060: Stock — número de lote y días de anticipación de alerta
-- Sprint 1.1 (2026-04-26)
--
-- Agrega 2 columnas a stock_items:
--   • lot_number       — para FIFO simple (Sprint 2 traerá tabla stock_batches
--                        con FIFO real granular). Nullable porque productos
--                        existentes pueden no tener lote conocido.
--   • alert_days_before — cuántos días antes del vencimiento Chapi avisa.
--                         Default 3 (alineado con la regla actual "≤3 días"
--                         que ya usa el reporte nocturno).
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
