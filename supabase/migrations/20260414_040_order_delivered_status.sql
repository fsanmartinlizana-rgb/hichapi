-- ── S26.1: Estado 'delivered' para comandas entregadas pero no cobradas ────
-- Antes "entregada" mapeaba a 'paying' (ambiguo con "pidió la cuenta").
-- Separamos: 'delivered' = plato entregado, aún no cobrado.
-- 'paying' sigue siendo "cliente pidió la cuenta via Chapi" (puede coexistir).

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'partial_ready',
    'ready', 'paying', 'delivered', 'paid', 'cancelled'
  ));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bill_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_delivered_idx
  ON orders (restaurant_id, status)
  WHERE status = 'delivered';

COMMENT ON COLUMN orders.delivered_at IS
  'Timestamp cuando el garzón marcó el pedido como entregado (status=delivered).';
COMMENT ON COLUMN orders.bill_requested_at IS
  'Timestamp cuando el cliente pidió la cuenta via Chapi (no bloquea el flujo).';
