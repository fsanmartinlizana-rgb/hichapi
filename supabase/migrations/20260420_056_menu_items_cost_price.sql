-- Add cost_price column to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS cost_price INTEGER CHECK (cost_price >= 0);

COMMENT ON COLUMN menu_items.cost_price IS
  'Costo de producción del ítem en pesos (CLP). Usado para calcular margen.';
