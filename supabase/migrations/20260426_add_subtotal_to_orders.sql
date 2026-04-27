-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Agregar campo subtotal a orders
-- Fecha: 2026-04-26
-- 
-- Propósito: Separar el subtotal (sin propina) del total (con propina) para
--            cumplir con requisitos del SII que no permite incluir propinas
--            en documentos tributarios electrónicos.
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

-- 4. Agregar constraint: total debe ser subtotal + tip
ALTER TABLE orders 
  ADD CONSTRAINT orders_total_equals_subtotal_plus_tip 
  CHECK (total = subtotal + tip);

-- 5. Comentarios
COMMENT ON COLUMN orders.subtotal IS 'Subtotal de la orden sin propina (para DTE)';
COMMENT ON COLUMN orders.tip IS 'Propina agregada por el cliente (no va en DTE)';
COMMENT ON CONSTRAINT orders_total_equals_subtotal_plus_tip ON orders IS 
  'Garantiza que total = subtotal + tip. El SII no permite propinas en DTEs.';
