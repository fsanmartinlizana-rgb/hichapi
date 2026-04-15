-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 048: Multi-brand, multi-location, kitchen stations + dynamic stock
--
-- Objetivo:
--   - Soportar marcas con N locales (El Dante 1949: Jorge Washington + Irarrázaval)
--   - Soportar locales con N estaciones de preparación (cocina fría/caliente/bar/parrilla)
--   - Routing automático de items a la estación correcta según categoría
--   - Configuración DINÁMICA por restaurante: compartir menú, compartir stock,
--     reporte consolidado, operación independiente. Todo toggle-able.
--   - 100% aditivo: no toca nada existente, todo nullable, backfill defensivo.
--
-- Reglas:
--   - brand_id, location_id, station_id: SIEMPRE nullable
--   - Si restaurante no tiene brand/location/station → se comporta exactamente como hoy
--   - No cambia RLS de tablas existentes; solo agrega policies para las nuevas
--   - No modifica triggers existentes
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. BRANDS ────────────────────────────────────────────────────────────────
-- Marca comercial (ej: "El Dante 1949"). Opcional: un restaurante puede no
-- tener brand (legacy) o tenerla compartida con otros locales.

CREATE TABLE IF NOT EXISTS brands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  logo_url        TEXT,
  primary_color   TEXT,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Configuración dinámica a nivel marca (defaults que heredan los locations):
  share_menu      BOOLEAN NOT NULL DEFAULT false, -- menú único compartido
  share_stock     BOOLEAN NOT NULL DEFAULT false, -- inventario compartido
  share_reports   BOOLEAN NOT NULL DEFAULT true,  -- reporte consolidado (default ON)

  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands(owner_id);

-- ── 2. LOCATIONS ─────────────────────────────────────────────────────────────
-- Lugar físico con dirección, mesas, caja y turnos propios.
-- Un restaurante legacy (sin brand) puede no tener location.

CREATE TABLE IF NOT EXISTS locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID REFERENCES brands(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE, -- cada location mapea a 1 restaurant
  name            TEXT NOT NULL,     -- "Jorge Washington"
  slug            TEXT,              -- url-safe
  address         TEXT,
  neighborhood    TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  phone           TEXT,
  whatsapp_number TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,

  -- Overrides de marca (NULL = hereda de brand; boolean = override explícito):
  share_menu_override    BOOLEAN,
  share_stock_override   BOOLEAN,
  share_reports_override BOOLEAN,

  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_locations_brand ON locations(brand_id);
CREATE INDEX IF NOT EXISTS idx_locations_restaurant ON locations(restaurant_id);

-- ── 3. STATIONS ──────────────────────────────────────────────────────────────
-- Estación de preparación: cocina caliente, cocina fría, barra, parrilla, postres.
-- Vive en una location. Puede imprimir en un print_server específico.

CREATE TABLE IF NOT EXISTS stations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID REFERENCES locations(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE, -- denormalizado para RLS rápido
  name            TEXT NOT NULL,     -- "Cocina caliente JW"
  kind            TEXT NOT NULL DEFAULT 'cocina' CHECK (kind IN (
    'cocina', 'cocina_fria', 'cocina_caliente', 'parrilla', 'horno',
    'barra', 'postres', 'panaderia', 'otro'
  )),
  print_server_id UUID, -- FK a print_servers se agrega condicionalmente más abajo si la tabla existe
  color           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stations_location ON stations(location_id);
CREATE INDEX IF NOT EXISTS idx_stations_restaurant ON stations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stations_print_server ON stations(print_server_id);

-- ── 4. MENU_CATEGORIES ───────────────────────────────────────────────────────
-- Categorías como entidad (hoy menu_items.category es TEXT libre).
-- Permite routing estable a stations por categoría.
-- brand_id nullable → restaurant puede tener categorías propias o compartidas con su marca.

CREATE TABLE IF NOT EXISTS menu_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID REFERENCES brands(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT,
  icon            TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_brand ON menu_categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories(restaurant_id);

-- ── 5. MENU_CATEGORY_STATION ─────────────────────────────────────────────────
-- Ruteo default por categoría: "Hamburguesas" → station "Cocina JW"
-- Una categoría puede rutear a múltiples stations (ej: pizzas van a cocina Y se notifican al bar).

CREATE TABLE IF NOT EXISTS menu_category_station (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  station_id      UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT true, -- station principal (donde se prepara)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_mcs_category ON menu_category_station(category_id);
CREATE INDEX IF NOT EXISTS idx_mcs_station ON menu_category_station(station_id);

-- ── 6. MENU_ITEM_STATION_OVERRIDE ────────────────────────────────────────────
-- Override puntual: "Esta cazuela normalmente va a Cocina Caliente pero si está
-- en el menú chico del local JW, que la haga Cocina JW".

CREATE TABLE IF NOT EXISTS menu_item_station_override (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  station_id      UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE CASCADE, -- NULL = todos los locales
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, station_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_miso_item ON menu_item_station_override(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_miso_station ON menu_item_station_override(station_id);

-- ── 7. MENU_ITEM_LOCATION_AVAILABILITY ───────────────────────────────────────
-- Para menú compartido: qué items están disponibles en qué location.
-- Si no hay fila → disponible en TODAS las locations de la marca (default).
-- Permite también override de precio por location.

CREATE TABLE IF NOT EXISTS menu_item_location_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  available       BOOLEAN NOT NULL DEFAULT true,
  price_override  INTEGER, -- CLP, NULL = usa precio base del menu_item
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_mila_item ON menu_item_location_availability(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mila_location ON menu_item_location_availability(location_id);

-- ── 8. ALTER EXISTING TABLES (todo nullable — no rompe nada) ─────────────────

-- restaurants: apuntan opcionalmente a una brand y a su location principal
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS brand_id             UUID REFERENCES brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_location_id  UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_brand ON restaurants(brand_id);

-- tables: pertenecen a una location específica (NULL = legacy, comportamiento actual)
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tables_location ON tables(location_id);

-- menu_items: FK opcional a categoría (legacy sigue usando string)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- order_items: cada item se rutea a una station (NULL = fallback a destination)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_station ON order_items(station_id);

-- orders: denormalizar location_id para reportes rápidos por local
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);

-- stock_items: opcionalmente compartido por brand (cuando brand.share_stock = true)
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_items_brand ON stock_items(brand_id);

-- stock_movements: registrar en qué location se consumió el stock compartido
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);

-- print_servers: un print_server puede pertenecer a una location específica
-- (condicional: solo si la tabla print_servers ya fue creada por migration 031)
DO $do_ps$
BEGIN
  IF to_regclass('public.print_servers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE print_servers ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_print_servers_location ON print_servers(location_id)';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'stations_print_server_id_fkey'
         AND conrelid = 'public.stations'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE stations ADD CONSTRAINT stations_print_server_id_fkey FOREIGN KEY (print_server_id) REFERENCES print_servers(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $do_ps$;

-- ── 9. NOTIFICATIONS: nuevos tipos ───────────────────────────────────────────
-- No necesita ALTER: notifications.type es TEXT libre. Solo documentamos:
--   type='station_ready'  → "Cazuela lista — retirar en Irarrázaval"
--   type='item_ready'     → item individual listo
--   type='location_pickup'→ cuando hay que ir a otra location a buscar un plato
COMMENT ON COLUMN notifications.type IS
  'Tipo de notificación: bill_requested, station_ready, item_ready, location_pickup, stock_low, cash_mismatch, shift_change, etc. Free-form text.';

-- ── 10. HELPER: resolver station para un menu_item en una location ───────────
-- Prioridad:
--   1. menu_item_station_override (específico al item + location)
--   2. menu_item_station_override (item sin location = aplica a todas)
--   3. menu_category_station del item en esa location (categoría → stations de esa location)
--   4. NULL → fallback a order_items.destination

CREATE OR REPLACE FUNCTION resolve_station_for_item(
  p_menu_item_id UUID,
  p_location_id  UUID
) RETURNS UUID AS $fn_resolve$
DECLARE
  v_station_id UUID;
  v_category_id UUID;
BEGIN
  -- 1. Override específico con location
  SELECT station_id INTO v_station_id
  FROM menu_item_station_override
  WHERE menu_item_id = p_menu_item_id
    AND location_id = p_location_id
  LIMIT 1;
  IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;

  -- 2. Override global (location = NULL)
  SELECT station_id INTO v_station_id
  FROM menu_item_station_override
  WHERE menu_item_id = p_menu_item_id
    AND location_id IS NULL
  LIMIT 1;
  IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;

  -- 3. Por categoría del item, filtrando stations de la location
  SELECT mi.category_id INTO v_category_id FROM menu_items mi WHERE mi.id = p_menu_item_id;
  IF v_category_id IS NOT NULL AND p_location_id IS NOT NULL THEN
    SELECT mcs.station_id INTO v_station_id
    FROM menu_category_station mcs
    JOIN stations s ON s.id = mcs.station_id
    WHERE mcs.category_id = v_category_id
      AND s.location_id   = p_location_id
      AND mcs.is_primary  = true
      AND s.active        = true
    LIMIT 1;
    IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;
  END IF;

  -- 4. Si no hay location pero hay categoría, tomar cualquier station primaria
  IF v_category_id IS NOT NULL THEN
    SELECT mcs.station_id INTO v_station_id
    FROM menu_category_station mcs
    JOIN stations s ON s.id = mcs.station_id
    WHERE mcs.category_id = v_category_id
      AND mcs.is_primary  = true
      AND s.active        = true
    LIMIT 1;
    IF v_station_id IS NOT NULL THEN RETURN v_station_id; END IF;
  END IF;

  RETURN NULL;
END;
$fn_resolve$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. HELPER: configuración efectiva de sharing por restaurant ─────────────
-- Evalúa el override de location sobre el default de brand.
-- Retorna: { share_menu, share_stock, share_reports }

CREATE OR REPLACE FUNCTION effective_sharing_config(p_restaurant_id UUID)
RETURNS TABLE(share_menu BOOLEAN, share_stock BOOLEAN, share_reports BOOLEAN) AS $fn_effective$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(l.share_menu_override,    b.share_menu,    false),
    COALESCE(l.share_stock_override,   b.share_stock,   false),
    COALESCE(l.share_reports_override, b.share_reports, true)
  FROM restaurants r
  LEFT JOIN brands    b ON b.id = r.brand_id
  LEFT JOIN locations l ON l.id = r.primary_location_id
  WHERE r.id = p_restaurant_id
  LIMIT 1;
END;
$fn_effective$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 12. RLS POLICIES (nuevas tablas) ─────────────────────────────────────────

ALTER TABLE brands                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_category_station           ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_station_override      ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_location_availability ENABLE ROW LEVEL SECURITY;

-- Brands: owner o restaurants que apuntan a esta brand
DROP POLICY IF EXISTS brands_select ON brands;
CREATE POLICY brands_select ON brands FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM restaurants r WHERE r.brand_id = brands.id AND r.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM team_members tm
             JOIN restaurants r ON r.id = tm.restaurant_id
             WHERE r.brand_id = brands.id AND tm.user_id = auth.uid())
);
DROP POLICY IF EXISTS brands_insert ON brands;
CREATE POLICY brands_insert ON brands FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS brands_update ON brands;
CREATE POLICY brands_update ON brands FOR UPDATE USING (owner_id = auth.uid());

-- Locations: ver si el usuario pertenece al restaurant del location
DROP POLICY IF EXISTS locations_select ON locations;
CREATE POLICY locations_select ON locations FOR SELECT USING (
  EXISTS (SELECT 1 FROM restaurants r
          WHERE r.id = locations.restaurant_id
          AND (r.owner_id = auth.uid()
               OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.restaurant_id = r.id AND tm.user_id = auth.uid())))
);
DROP POLICY IF EXISTS locations_all_owner ON locations;
CREATE POLICY locations_all_owner ON locations FOR ALL USING (
  EXISTS (SELECT 1 FROM restaurants r
          WHERE r.id = locations.restaurant_id AND r.owner_id = auth.uid())
);

-- Stations: mismo criterio — por restaurant
DROP POLICY IF EXISTS stations_select ON stations;
CREATE POLICY stations_select ON stations FOR SELECT USING (
  EXISTS (SELECT 1 FROM restaurants r
          WHERE r.id = stations.restaurant_id
          AND (r.owner_id = auth.uid()
               OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.restaurant_id = r.id AND tm.user_id = auth.uid())))
);
DROP POLICY IF EXISTS stations_all_owner ON stations;
CREATE POLICY stations_all_owner ON stations FOR ALL USING (
  EXISTS (SELECT 1 FROM restaurants r
          WHERE r.id = stations.restaurant_id AND r.owner_id = auth.uid())
);

-- Menu categories: por restaurant o por brand (si está compartida)
DROP POLICY IF EXISTS menu_categories_select ON menu_categories;
CREATE POLICY menu_categories_select ON menu_categories FOR SELECT USING (
  (restaurant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = menu_categories.restaurant_id
    AND (r.owner_id = auth.uid()
         OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.restaurant_id = r.id AND tm.user_id = auth.uid()))))
  OR (brand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM brands b WHERE b.id = menu_categories.brand_id AND b.owner_id = auth.uid()))
);
DROP POLICY IF EXISTS menu_categories_all_owner ON menu_categories;
CREATE POLICY menu_categories_all_owner ON menu_categories FOR ALL USING (
  (restaurant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = menu_categories.restaurant_id AND r.owner_id = auth.uid()))
  OR (brand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM brands b WHERE b.id = menu_categories.brand_id AND b.owner_id = auth.uid()))
);

-- menu_category_station: permisivo — si podés ver la station, podés ver el mapping
DROP POLICY IF EXISTS mcs_select ON menu_category_station;
CREATE POLICY mcs_select ON menu_category_station FOR SELECT USING (
  EXISTS (SELECT 1 FROM stations s
          JOIN restaurants r ON r.id = s.restaurant_id
          WHERE s.id = menu_category_station.station_id
          AND (r.owner_id = auth.uid()
               OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.restaurant_id = r.id AND tm.user_id = auth.uid())))
);
DROP POLICY IF EXISTS mcs_all_owner ON menu_category_station;
CREATE POLICY mcs_all_owner ON menu_category_station FOR ALL USING (
  EXISTS (SELECT 1 FROM stations s
          JOIN restaurants r ON r.id = s.restaurant_id
          WHERE s.id = menu_category_station.station_id AND r.owner_id = auth.uid())
);

-- menu_item_station_override: por station
DROP POLICY IF EXISTS miso_all_owner ON menu_item_station_override;
CREATE POLICY miso_all_owner ON menu_item_station_override FOR ALL USING (
  EXISTS (SELECT 1 FROM stations s
          JOIN restaurants r ON r.id = s.restaurant_id
          WHERE s.id = menu_item_station_override.station_id AND r.owner_id = auth.uid())
);

-- menu_item_location_availability: por location
DROP POLICY IF EXISTS mila_all_owner ON menu_item_location_availability;
CREATE POLICY mila_all_owner ON menu_item_location_availability FOR ALL USING (
  EXISTS (SELECT 1 FROM locations l
          JOIN restaurants r ON r.id = l.restaurant_id
          WHERE l.id = menu_item_location_availability.location_id AND r.owner_id = auth.uid())
);

-- Customers (anon) leen menus compartidos/availability vía endpoints públicos — no desde RLS directo.

-- ── 13. REALTIME: habilitar las nuevas tablas que vamos a suscribir ──────────
-- Supabase replica por default en 'supabase_realtime' publication.
-- Agregamos stations (para dashboard de cocina) y menu_item_location_availability
-- (para que la carta del cliente se actualice al toque si cambia disponibilidad).

DO $do_pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE stations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE menu_item_location_availability;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE locations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $do_pub$;

-- ── 14. BACKFILL DEFENSIVO ───────────────────────────────────────────────────
-- Para cada restaurant existente: crear 1 brand, 1 location, 1 station "Cocina"
-- y 1 station "Barra" por default. Esto mantiene comportamiento actual IDÉNTICO:
--   - Restaurante sin multi-location → sigue trabajando como si nada
--   - Si en el futuro se le activa share_menu=true, ya tiene la infra
-- Seguro de re-ejecutar: usa ON CONFLICT DO NOTHING implícito (check por existencia).

DO $do_backfill$
DECLARE
  r RECORD;
  v_brand_id UUID;
  v_location_id UUID;
  v_cocina_id UUID;
  v_barra_id UUID;
BEGIN
  FOR r IN SELECT id, name, slug, owner_id FROM restaurants WHERE brand_id IS NULL LOOP
    -- Brand (1 por restaurant, mismo nombre)
    INSERT INTO brands (name, slug, owner_id, share_menu, share_stock, share_reports)
    VALUES (r.name, r.slug || '-brand-' || substr(r.id::text, 1, 8), r.owner_id, false, false, true)
    RETURNING id INTO v_brand_id;

    -- Location (1 por restaurant, misma base)
    INSERT INTO locations (brand_id, restaurant_id, name, slug, active)
    VALUES (v_brand_id, r.id, r.name, r.slug, true)
    RETURNING id INTO v_location_id;

    -- Apuntar restaurant a brand + location
    UPDATE restaurants
       SET brand_id = v_brand_id, primary_location_id = v_location_id
     WHERE id = r.id;

    -- Stations default: Cocina + Barra
    INSERT INTO stations (location_id, restaurant_id, name, kind, sort_order, active)
    VALUES (v_location_id, r.id, 'Cocina', 'cocina', 1, true)
    RETURNING id INTO v_cocina_id;

    INSERT INTO stations (location_id, restaurant_id, name, kind, sort_order, active)
    VALUES (v_location_id, r.id, 'Barra',  'barra',  2, true)
    RETURNING id INTO v_barra_id;

    -- Backfill tables.location_id → location default del restaurant
    UPDATE tables SET location_id = v_location_id
     WHERE restaurant_id = r.id AND location_id IS NULL;

    -- Backfill orders.location_id → location default del restaurant
    UPDATE orders SET location_id = v_location_id
     WHERE restaurant_id = r.id AND location_id IS NULL;

    -- Backfill print_servers.location_id si la tabla existe
    IF to_regclass('public.print_servers') IS NOT NULL THEN
      EXECUTE format(
        'UPDATE print_servers SET location_id = %L WHERE restaurant_id = %L AND location_id IS NULL',
        v_location_id, r.id
      );
    END IF;
  END LOOP;
END $do_backfill$;

-- ── 15. TRIGGER: backfill location_id en orders nuevas ───────────────────────
-- Si se crea una orden y no se especifica location_id, lo heredamos de la tabla.

CREATE OR REPLACE FUNCTION orders_set_location_id() RETURNS TRIGGER AS $fn_orders_loc$
BEGIN
  IF NEW.location_id IS NULL AND NEW.table_id IS NOT NULL THEN
    SELECT t.location_id INTO NEW.location_id FROM tables t WHERE t.id = NEW.table_id;
    IF NEW.location_id IS NULL THEN
      SELECT r.primary_location_id INTO NEW.location_id FROM restaurants r WHERE r.id = NEW.restaurant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn_orders_loc$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_set_location ON orders;
CREATE TRIGGER trg_orders_set_location
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_set_location_id();

-- ── 16. TRIGGER: backfill station_id en order_items nuevos ───────────────────
-- Si al insertar un order_item no se especifica station_id, resolver usando la función.

CREATE OR REPLACE FUNCTION order_items_set_station_id() RETURNS TRIGGER AS $fn_items_st$
DECLARE
  v_location_id UUID;
BEGIN
  IF NEW.station_id IS NULL AND NEW.menu_item_id IS NOT NULL THEN
    SELECT o.location_id INTO v_location_id FROM orders o WHERE o.id = NEW.order_id;
    NEW.station_id := resolve_station_for_item(NEW.menu_item_id, v_location_id);
  END IF;
  RETURN NEW;
END;
$fn_items_st$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_items_set_station ON order_items;
CREATE TRIGGER trg_order_items_set_station
  BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION order_items_set_station_id();

-- ── Fin ──────────────────────────────────────────────────────────────────────
-- NOTA: Este migration NO crea UI ni APIs; solo schema + backfill + helpers.
-- Los endpoints de admin (/api/brands, /api/locations, /api/stations) y la UI
-- en /configuracion/estaciones se construyen en commits siguientes, sobre esta base.
