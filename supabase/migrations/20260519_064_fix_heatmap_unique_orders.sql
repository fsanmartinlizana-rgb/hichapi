-- Migration 064: Fix Heatmap Unique Orders
-- Modifica la función heatmap_grid para contar órdenes únicas (COUNT(DISTINCT)) en lugar de pings GPS individuales.

CREATE OR REPLACE FUNCTION public.heatmap_grid(
  p_restaurant_id uuid DEFAULT NULL,
  p_days          int  DEFAULT 30,
  p_hour_from     int  DEFAULT NULL,
  p_hour_to       int  DEFAULT NULL,
  p_day_of_week   int  DEFAULT NULL   -- 0=Domingo
)
RETURNS TABLE (
  cell_lat    numeric,
  cell_lng    numeric,
  order_count bigint,
  avg_fee_clp numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ROUND(rl.lat / 0.0045, 0) * 0.0045  AS cell_lat,   -- ~500m en latitud
    ROUND(rl.lng / 0.0045, 0) * 0.0045  AS cell_lng,
    COUNT(DISTINCT do2.id)                AS order_count,
    ROUND(AVG(do2.delivery_fee_clp), 0)  AS avg_fee_clp
  FROM public.delivery_orders do2
  JOIN public.rider_locations rl ON rl.delivery_order_id = do2.id
  WHERE
    do2.status = 'delivered'
    AND do2.created_at >= now() - (p_days || ' days')::interval
    AND (p_restaurant_id IS NULL OR do2.restaurant_id = p_restaurant_id)
    AND (p_hour_from IS NULL OR EXTRACT(HOUR FROM do2.created_at AT TIME ZONE 'America/Santiago') >= p_hour_from)
    AND (p_hour_to   IS NULL OR EXTRACT(HOUR FROM do2.created_at AT TIME ZONE 'America/Santiago') <  p_hour_to)
    AND (p_day_of_week IS NULL OR EXTRACT(DOW FROM do2.created_at AT TIME ZONE 'America/Santiago') = p_day_of_week)
  GROUP BY cell_lat, cell_lng
  ORDER BY order_count DESC;
$$;
