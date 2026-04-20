-- ── mark_station_ready_by_stations ────────────────────────────────────
-- Multi-local: marca items listos filtrando por station_ids específicas.
--
-- Versión reescrita 2026-04-21: el SQL Editor de Supabase rechazaba la
-- versión con DECLARE + variables con error 42P01 "relation v_pending_count
-- does not exist". Re-escrito sin DECLARE usando subqueries inline.

CREATE OR REPLACE FUNCTION mark_station_ready_by_stations(
  p_order_id    UUID,
  p_station_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $mark_sr$
BEGIN
  UPDATE order_items
     SET station_status   = 'ready',
         station_ready_at = now()
   WHERE order_id = p_order_id
     AND station_id = ANY(p_station_ids)
     AND station_status <> 'ready';

  UPDATE orders
     SET status = (
       CASE
         WHEN (SELECT COUNT(*)
                 FROM order_items
                WHERE order_id = p_order_id
                  AND station_status <> 'ready'
                  AND destination   <> 'ninguno') = 0
         THEN 'ready'
         ELSE 'partial_ready'
       END
     )
   WHERE id = p_order_id
     AND status NOT IN ('paid', 'cancelled');

  RETURN jsonb_build_object(
    'order_id',          p_order_id,
    'pending_remaining', (SELECT COUNT(*)
                            FROM order_items
                           WHERE order_id = p_order_id
                             AND station_status <> 'ready'
                             AND destination   <> 'ninguno'),
    'order_status',      (SELECT status FROM orders WHERE id = p_order_id)
  );
END;
$mark_sr$;
