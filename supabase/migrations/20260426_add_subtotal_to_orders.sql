-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Agregar campo subtotal a orders
-- Fecha: 2026-04-26
--
-- Propósito: Separar el subtotal (sin propina) del total (con propina) para
--            cumplir con requisitos del SII que no permite incluir propinas
--            en documentos tributarios electrónicos.
--
-- Idempotente: usa IF NOT EXISTS en columnas y un DO $$ guard en el constraint
-- para que se pueda re-ejecutar sin truenar.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Agregar columna subtotal (sin propina) y tip (propina)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal INTEGER,
  ADD COLUMN IF NOT EXISTS tip INTEGER DEFAULT 0;

-- 2. Backfill: Para órdenes existentes, asumir que total = subtotal (sin propina)
UPDATE orders
SET
  subtotal = total,
  tip = 0
WHERE subtotal IS NULL;

-- 3. Hacer subtotal NOT NULL ahora que tiene valores
ALTER TABLE orders
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN subtotal SET DEFAULT 0;

-- 4. Agregar constraint: total debe ser subtotal + tip (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_total_equals_subtotal_plus_tip'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_total_equals_subtotal_plus_tip
      CHECK (total = subtotal + tip);
  END IF;
END $$;

-- 5. Comentarios
COMMENT ON COLUMN orders.subtotal IS 'Subtotal de la orden sin propina (para DTE)';
COMMENT ON COLUMN orders.tip IS 'Propina agregada por el cliente (no va en DTE)';
COMMENT ON CONSTRAINT orders_total_equals_subtotal_plus_tip ON orders IS
  'Garantiza que total = subtotal + tip. El SII no permite propinas en DTEs.';
