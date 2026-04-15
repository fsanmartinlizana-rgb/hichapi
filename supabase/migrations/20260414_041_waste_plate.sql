-- ── S27.4: Merma de platos (no solo de stock) ───────────────────────────
-- El garzón/cocina puede marcar que un plato terminado se botó (se quemó,
-- llegó frío, cliente lo rechazó, error en preparación, etc).
-- Se persiste en la misma waste_log con item_type='plato' y menu_item_id.

ALTER TABLE waste_log
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type    TEXT NOT NULL DEFAULT 'stock'
    CHECK (item_type IN ('stock','plato'));

-- Extiende el CHECK de reason con razones específicas de plato
ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_reason_check;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_reason_check
  CHECK (reason IN (
    'vencimiento','deterioro','rotura','error_prep','sobras','devolucion','otro',
    'merma','perdida',
    'plato_quemado','plato_frio','plato_mal_preparado','plato_devuelto','plato_caido'
  ));

-- Row-level rule: al menos uno de (stock_item_id, menu_item_id) debe estar
ALTER TABLE waste_log DROP CONSTRAINT IF EXISTS waste_log_item_presence;
ALTER TABLE waste_log ADD CONSTRAINT waste_log_item_presence
  CHECK (stock_item_id IS NOT NULL OR menu_item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS waste_log_menu_item_idx
  ON waste_log (restaurant_id, menu_item_id)
  WHERE menu_item_id IS NOT NULL;

COMMENT ON COLUMN waste_log.menu_item_id IS
  'Plato (del menú) que se botó. Úsalo cuando el plato ya está preparado.';
COMMENT ON COLUMN waste_log.item_type IS
  'stock = insumo crudo. plato = plato terminado de la carta.';
