-- ── Fix cross-local sync: RPC por station_id en vez de destination ───────
-- Bug: mark_station_ready(order_id, destination) marca TODOS los items con
-- destination='cocina'. Con multi-local, si la order tiene items de cocina
-- en Irra y cocina en JW, al marcar "cocina lista" en cualquiera de los 2
-- locales, se marcan los items del OTRO también (el estado se sincroniza
-- mal entre locales).
--
-- Fix: nueva RPC mark_station_ready_by_stations que recibe UUID[] de
-- stations específicas. El endpoint /api/orders/station pasa las stations
-- del restaurant actual, así cada panel solo marca listos los items que
-- realmente prepara. La RPC antigua queda por compatibilidad con el flow
-- legacy (sin multi-local).

CREATE OR REPLACE FUNCTION mark_station_ready_by_stations(
  p_order_id    UUID,
  p_station_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_count INT;
  v_pending_count  INT;
  v_total_count    INT;
  v_new_order_status TEXT;
BEGIN
  -- Marcar solo items cuyo station_id esté en la lista provista
  UPDATE order_items
  SET station_status   = 'ready',
      station_ready_at = now()
  WHERE order_id = p_order_id
    AND station_id = ANY(p_station_ids)
    AND station_status <> 'ready';

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  -- Contar items pendientes (todos los del order, excluyendo 'ninguno')
  SELECT
    COUNT(*) FILTER (WHERE station_status <> 'ready' AND destination <> 'ninguno'),
    COUNT(*)
  INTO v_pending_count, v_total_count
  FROM order_items
  WHERE order_id = p_order_id;

  -- Decidir status del order padre
  IF v_pending_count = 0 THEN
    v_new_order_status := 'ready';
  ELSE
    v_new_order_status := 'partial_ready';
  END IF;

  UPDATE orders
  SET status = v_new_order_status
  WHERE id = p_order_id
    AND status NOT IN ('paid', 'cancelled');

  RETURN jsonb_build_object(
    'order_id',            p_order_id,
    'affected_items',      v_affected_count,
    'pending_remaining',   v_pending_count,
    'order_status',        v_new_order_status
  );
END;
$$;

COMMENT ON FUNCTION mark_station_ready_by_stations IS
  'Multi-local: marca listos los items cuyo station_id esté en el array provisto. Usado desde paneles que conocen sus propias stations.';
