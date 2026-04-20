-- ══════════════════════════════════════════════════════════════════════════
-- Script de limpieza de data operativa — El Dante (2 locales).
-- Preserva: carta (menu_items), mesas (tables), stock_items, stations,
-- categorías, promociones, equipo (team_members), brand, locations, config.
-- Borra: pedidos, items, lista de espera, mermas, movimientos de stock,
-- sesiones de caja, notificaciones, eventos de geofence.
--
-- Uso: pegar en Supabase SQL Editor y ejecutar. Es idempotente y transaccional.
-- Solo afecta los restaurants con slug que empieza con 'el-dante'.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Confirmar el set de restaurants que vamos a limpiar.
-- Antes de DELETE mostramos qué se va a tocar. Si el SELECT devuelve
-- restaurants que NO querías, hace ROLLBACK y ajustá el filtro.
WITH targets AS (
  SELECT id, name, slug
  FROM restaurants
  WHERE slug LIKE 'el-dante%'
)
SELECT 'RESTAURANTS A LIMPIAR:' AS info, id, name, slug
FROM targets;

-- 2. Borrar data operativa. Orden importante por FKs (child primero).

-- order_items se borran automáticamente por ON DELETE CASCADE cuando se
-- borra la order padre, pero somos explícitos por claridad.
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%')
);

DELETE FROM orders
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- Waitlist (lista de espera)
DELETE FROM waitlist
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- Mermas y movimientos de stock (pero NO stock_items en sí)
DELETE FROM waste_log
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

DELETE FROM stock_movements
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- Sesiones de caja
DELETE FROM cash_register_sessions
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- Notificaciones del panel
DELETE FROM notifications
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- Geofence events (solo si la tabla ya existe — migration 054)
DO $$
BEGIN
  IF to_regclass('public.geofence_events') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM geofence_events
      WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%')
    $q$;
  END IF;
END $$;

-- API request log (si hay keys del restaurant)
DO $$
BEGIN
  IF to_regclass('public.api_request_log') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM api_request_log
      WHERE api_key_id IN (
        SELECT id FROM api_keys
        WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%')
      )
    $q$;
  END IF;
END $$;

-- Resetear mesas a "libre" sin borrarlas
UPDATE tables
SET status = 'libre'
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'el-dante%');

-- 3. Mostrar resumen de lo que queda para verificación.
SELECT
  r.slug,
  r.name,
  (SELECT COUNT(*) FROM menu_items mi WHERE mi.restaurant_id = r.id) AS platos_en_carta,
  (SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = r.id)       AS mesas,
  (SELECT COUNT(*) FROM stock_items si WHERE si.restaurant_id = r.id) AS insumos_stock,
  (SELECT COUNT(*) FROM stations s WHERE s.restaurant_id = r.id)     AS estaciones,
  (SELECT COUNT(*) FROM promotions p WHERE p.restaurant_id = r.id)   AS promociones,
  (SELECT COUNT(*) FROM team_members tm WHERE tm.restaurant_id = r.id AND tm.active = true) AS equipo_activo,
  (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id)       AS pedidos_restantes,
  (SELECT COUNT(*) FROM waitlist w WHERE w.restaurant_id = r.id)     AS espera_restante
FROM restaurants r
WHERE r.slug LIKE 'el-dante%'
ORDER BY r.slug;

-- Si todo se ve bien, confirmá con COMMIT. Si algo está mal, ROLLBACK.
-- COMMIT;
-- ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: el script termina con BEGIN abierto. Tenés que ejecutar
-- COMMIT manualmente después de revisar el resultado del último SELECT.
-- Si algo se ve mal → ROLLBACK y nada se modifica.
-- ══════════════════════════════════════════════════════════════════════════
