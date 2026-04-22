-- ══════════════════════════════════════════════════════════════════════════════
-- Migración: Agregar columna pax a orders
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   • orders.pax (int, nullable) — número de comensales registrado por el garzón
--
-- Nota: destination en order_items ya existe (migración 20260410_026_sprint8_destinations.sql)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pax int DEFAULT NULL;

COMMENT ON COLUMN orders.pax IS
  'Número de comensales en la mesa al momento de abrir la comanda. Registrado por el garzón. NULL si no fue especificado.';
