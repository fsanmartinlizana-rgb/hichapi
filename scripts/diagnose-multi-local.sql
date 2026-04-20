-- ══════════════════════════════════════════════════════════════════════════
-- Diagnóstico multi-local: verifica que las migrations 048+ estén aplicadas
-- y que todas las columnas requeridas para el ruteo cross-local existan.
--
-- Uso: pegar en Supabase SQL Editor y ejecutar. Solo lee, no modifica nada.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Columnas críticas que agregó la migration 048.
-- Si alguna dice "FALTA", corré esa migration antes de seguir.
SELECT
  'order_items.station_id' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'station_id'
  ) THEN '✓ existe' ELSE '✗ FALTA' END AS estado
UNION ALL
SELECT
  'orders.location_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'location_id'
  ) THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT
  'restaurants.brand_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'brand_id'
  ) THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT
  'menu_items.category_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_id'
  ) THEN '✓ existe' ELSE '✗ FALTA' END;

-- 2. Tablas del sistema multi-local (migration 048).
SELECT
  'brands' AS tabla,
  CASE WHEN to_regclass('public.brands') IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END AS estado
UNION ALL
SELECT 'locations',                 CASE WHEN to_regclass('public.locations')                 IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT 'stations',                  CASE WHEN to_regclass('public.stations')                  IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT 'menu_categories',           CASE WHEN to_regclass('public.menu_categories')           IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT 'menu_category_station',     CASE WHEN to_regclass('public.menu_category_station')     IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END
UNION ALL
SELECT 'menu_item_station_override',CASE WHEN to_regclass('public.menu_item_station_override')IS NOT NULL THEN '✓ existe' ELSE '✗ FALTA' END;

-- 3. Ver la configuración actual de los dos restaurants El Dante.
SELECT
  r.slug,
  r.name,
  r.brand_id IS NOT NULL AS tiene_brand,
  (SELECT name FROM brands b WHERE b.id = r.brand_id) AS brand_name,
  (SELECT COUNT(*) FROM locations l WHERE l.brand_id = r.brand_id) AS locales_en_brand,
  (SELECT COUNT(*) FROM stations s WHERE s.restaurant_id = r.id)    AS mis_estaciones,
  (SELECT COUNT(*) FROM menu_categories mc
    WHERE mc.brand_id = r.brand_id OR mc.restaurant_id = r.id)      AS categorias_visibles,
  (SELECT COUNT(*) FROM menu_category_station mcs
    JOIN stations s2 ON s2.id = mcs.station_id
    WHERE s2.restaurant_id = r.id)                                   AS categorias_ruteadas_a_mis_estaciones
FROM restaurants r
WHERE r.slug LIKE 'el-dante%'
ORDER BY r.slug;

-- 4. ÚLTIMO pedido creado por restaurant (para ver si el insert de
--    order_items se quedó vacío — síntoma del bug reportado).
SELECT
  r.slug,
  o.id AS order_id,
  o.status,
  o.created_at,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
FROM orders o
JOIN restaurants r ON r.id = o.restaurant_id
WHERE r.slug LIKE 'el-dante%'
ORDER BY o.created_at DESC
LIMIT 10;
