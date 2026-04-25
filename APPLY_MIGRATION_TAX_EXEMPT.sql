-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: Soporte para ítems exentos de IVA
-- Agrega columna tax_exempt a menu_items y order_items
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Agregar tax_exempt a menu_items (default false = afecto a IVA normal)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false;

-- 2. Agregar tax_exempt a order_items (se hereda del menu_item al crear la orden)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false;

-- Comentarios
COMMENT ON COLUMN menu_items.tax_exempt IS 'true = ítem exento de IVA (ind_exe=1 en DTE). Ej: cigarros, medicamentos.';
COMMENT ON COLUMN order_items.tax_exempt IS 'Heredado de menu_items.tax_exempt al crear la orden. Usado para ind_exe en DTE.';
