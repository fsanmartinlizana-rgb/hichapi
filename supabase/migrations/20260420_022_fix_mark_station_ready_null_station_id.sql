-- Fix: mark_station_ready_by_stations now also marks items with station_id = NULL
-- that match the destination corresponding to the given station_ids.
-- This handles restaurants that have stations configured but order_items
-- were created before station routing was set up (station_id = NULL).
--
-- The destination is inferred from the station kinds:
--   cocina, cocina_caliente, cocina_fria, parrilla, horno, postres, panaderia, otro → 'cocina'
--   barra → 'barra'

CREATE OR REPLACE FUNCTION mark_station_ready_by_stations(
  p_order_id    UUID,
  p_station_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $mark_sr$
DECLARE
  v_destinations TEXT[];
BEGIN
  -- Determine which destinations these station_ids cover
  SELECT ARRAY_AGG(DISTINCT
    CASE
      WHEN kind = 'barra' THEN 'barra'
      ELSE 'cocina'
    END
  )
  INTO v_destinations
  FROM stations
  WHERE id = ANY(p_station_ids);

  -- Mark items that have an explicit station_id match
  UPDATE order_items
     SET station_status   = 'ready',
         station_ready_at = now()
   WHERE order_id = p_order_id
     AND station_id = ANY(p_station_ids)
     AND station_status <> 'ready';

  -- Also mark items with station_id = NULL that match the destination
  -- (legacy items created before station routing was configured)
  IF v_destinations IS NOT NULL AND array_length(v_destinations, 1) > 0 THEN
    UPDATE order_items
       SET station_status   = 'ready',
           station_ready_at = now()
     WHERE order_id = p_order_id
       AND station_id IS NULL
       AND destination = ANY(v_destinations)
       AND station_status <> 'ready';
  END IF;

  -- Update order status
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
