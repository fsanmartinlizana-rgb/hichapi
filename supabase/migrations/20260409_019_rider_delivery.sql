-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019: Rider Delivery Module
-- Creates all tables, RLS policies, trigger, and RPC for the rider delivery system
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. rider_profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rider_profiles (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text        NOT NULL,
  phone               text        NOT NULL,
  national_id         text        NOT NULL,  -- RUT, nunca expuesto a restaurantes
  profile_photo_url   text,
  vehicle_type        text        NOT NULL
                        CHECK (vehicle_type IN ('bicycle','motorcycle','car','cargo_bike')),
  license_plate       text,
  vehicle_model       text,
  status              text        NOT NULL DEFAULT 'pending_verification'
                        CHECK (status IN (
                          'pending_verification','available','offline','busy','suspended'
                        )),
  document_status     text        NOT NULL DEFAULT 'pending'
                        CHECK (document_status IN (
                          'pending','documents_submitted','approved','rejected'
                        )),
  doc_national_id_url text,
  doc_license_url     text,
  doc_insurance_url   text,
  avg_rating          numeric(3,1),
  total_ratings       int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── 2. delivery_zones ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  radius_km     numeric(5,2) NOT NULL CHECK (radius_km BETWEEN 1 AND 50),
  center_lat    numeric(10,7) NOT NULL,
  center_lng    numeric(10,7) NOT NULL,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 3. delivery_fee_tiers ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_fee_tiers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  min_km        numeric(5,2) NOT NULL DEFAULT 0,
  max_km        numeric(5,2),  -- NULL = sin límite superior
  fee_clp       int         NOT NULL CHECK (fee_clp >= 0),
  vehicle_types text[]      NOT NULL DEFAULT '{}',  -- vacío = todos los tipos
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 4. delivery_orders ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  order_id          uuid        REFERENCES public.orders(id) ON DELETE SET NULL,  -- FK nullable
  rider_id          uuid        REFERENCES public.rider_profiles(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'pending_assignment'
                      CHECK (status IN (
                        'pending_assignment','assigned','picked_up',
                        'in_transit','delivered','cancelled','failed'
                      )),
  pickup_address    text        NOT NULL,
  delivery_address  text        NOT NULL,
  client_name       text        NOT NULL,
  client_phone      text        NOT NULL,
  total_clp         int         NOT NULL CHECK (total_clp >= 0),
  delivery_fee_clp  int         CHECK (delivery_fee_clp >= 0),
  failure_reason    text        CHECK (failure_reason IN (
                      'customer_not_found','address_incorrect',
                      'refused_delivery','vehicle_breakdown','other'
                    )),
  planned_route     jsonb,       -- polyline + instrucciones de Google Maps
  actual_gps_track  jsonb,       -- array de {lat, lng, recorded_at}
  picked_up_at      timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 5. rider_locations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rider_locations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id          uuid        NOT NULL REFERENCES public.rider_profiles(id) ON DELETE CASCADE,
  delivery_order_id uuid        REFERENCES public.delivery_orders(id) ON DELETE SET NULL,
  lat               numeric(10,7) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng               numeric(10,7) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas de posición reciente por rider
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider_recorded
  ON public.rider_locations(rider_id, recorded_at DESC);

-- ── 6. rider_ratings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rider_ratings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id uuid        NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  rider_id          uuid        NOT NULL REFERENCES public.rider_profiles(id) ON DELETE CASCADE,
  restaurant_id     uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rated_by          uuid        NOT NULL REFERENCES auth.users(id),
  stars             int         NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_order_id)  -- una sola calificación por pedido
);

-- ── 7. rider_blocked_restaurants ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rider_blocked_restaurants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rider_id      uuid        NOT NULL REFERENCES public.rider_profiles(id) ON DELETE CASCADE,
  blocked_at    timestamptz NOT NULL DEFAULT now(),
  blocked_by    uuid        NOT NULL REFERENCES auth.users(id),
  UNIQUE (restaurant_id, rider_id)
);

-- ── 8. Trigger: actualizar avg_rating en rider_profiles ──────────────────────

CREATE OR REPLACE FUNCTION public.update_rider_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.rider_profiles
  SET
    avg_rating    = (
      SELECT ROUND(AVG(stars)::numeric, 1)
      FROM public.rider_ratings
      WHERE rider_id = NEW.rider_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM public.rider_ratings
      WHERE rider_id = NEW.rider_id
    ),
    updated_at = now()
  WHERE id = NEW.rider_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rider_avg_rating ON public.rider_ratings;
CREATE TRIGGER trg_update_rider_avg_rating
  AFTER INSERT ON public.rider_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_rider_avg_rating();

-- ── 9. RPC: heatmap_grid ─────────────────────────────────────────────────────

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

-- ── 10. RLS Policies ─────────────────────────────────────────────────────────

-- ── rider_profiles ────────────────────────────────────────────────────────────
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;

-- El rider solo puede leer su propio perfil; super_admin ve todos
CREATE POLICY "rider_profiles_self_read" ON public.rider_profiles
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_super_admin());

-- El rider solo puede actualizar su propio perfil
CREATE POLICY "rider_profiles_self_update" ON public.rider_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Solo super_admin o el propio rider puede insertar (la API usa service role)
CREATE POLICY "rider_profiles_insert_service" ON public.rider_profiles
  FOR INSERT
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);

-- ── delivery_zones ────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- El restaurante gestiona sus propias zonas; super_admin ve todas
CREATE POLICY "delivery_zones_restaurant_all" ON public.delivery_zones
  FOR ALL
  USING (restaurant_id = public.my_restaurant_id() OR public.is_super_admin());

-- Los riders pueden leer zonas activas (para el marketplace)
CREATE POLICY "delivery_zones_rider_read" ON public.delivery_zones
  FOR SELECT
  USING (active = true);

-- ── delivery_fee_tiers ────────────────────────────────────────────────────────
ALTER TABLE public.delivery_fee_tiers ENABLE ROW LEVEL SECURITY;

-- El restaurante gestiona sus propias tarifas; super_admin ve todas
CREATE POLICY "delivery_fee_tiers_restaurant_all" ON public.delivery_fee_tiers
  FOR ALL
  USING (restaurant_id = public.my_restaurant_id() OR public.is_super_admin());

-- Los riders pueden leer tarifas (información pública del marketplace)
CREATE POLICY "delivery_fee_tiers_rider_read" ON public.delivery_fee_tiers
  FOR SELECT
  USING (true);

-- ── delivery_orders ───────────────────────────────────────────────────────────
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

-- El restaurante ve y gestiona solo sus propios pedidos
CREATE POLICY "delivery_orders_restaurant_all" ON public.delivery_orders
  FOR ALL
  USING (restaurant_id = public.my_restaurant_id() OR public.is_super_admin());

-- El rider puede leer pedidos pending_assignment o los que le están asignados
CREATE POLICY "delivery_orders_rider_read" ON public.delivery_orders
  FOR SELECT
  USING (
    status = 'pending_assignment'
    OR rider_id = (SELECT id FROM public.rider_profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_super_admin()
  );

-- El rider puede actualizar solo los pedidos que le están asignados
CREATE POLICY "delivery_orders_rider_update" ON public.delivery_orders
  FOR UPDATE
  USING (
    rider_id = (SELECT id FROM public.rider_profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_super_admin()
  );

-- ── rider_locations ───────────────────────────────────────────────────────────
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

-- El rider puede insertar sus propias ubicaciones
CREATE POLICY "rider_locations_rider_insert" ON public.rider_locations
  FOR INSERT
  WITH CHECK (
    rider_id = (SELECT id FROM public.rider_profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- El rider puede leer sus propias ubicaciones
CREATE POLICY "rider_locations_rider_read" ON public.rider_locations
  FOR SELECT
  USING (
    rider_id = (SELECT id FROM public.rider_profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_super_admin()
  );

-- El restaurante puede leer ubicaciones de riders con pedidos activos asignados a él
CREATE POLICY "rider_locations_restaurant_read" ON public.rider_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_orders do2
      WHERE do2.id = delivery_order_id
        AND do2.restaurant_id = public.my_restaurant_id()
        AND do2.status IN ('assigned','picked_up','in_transit')
    )
    OR public.is_super_admin()
  );

-- ── rider_ratings ─────────────────────────────────────────────────────────────
ALTER TABLE public.rider_ratings ENABLE ROW LEVEL SECURITY;

-- El restaurante gestiona las calificaciones de sus pedidos
CREATE POLICY "rider_ratings_restaurant_all" ON public.rider_ratings
  FOR ALL
  USING (restaurant_id = public.my_restaurant_id() OR public.is_super_admin());

-- El rider puede leer sus propias calificaciones
CREATE POLICY "rider_ratings_rider_read" ON public.rider_ratings
  FOR SELECT
  USING (
    rider_id = (SELECT id FROM public.rider_profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_super_admin()
  );

-- ── rider_blocked_restaurants ─────────────────────────────────────────────────
ALTER TABLE public.rider_blocked_restaurants ENABLE ROW LEVEL SECURITY;

-- El restaurante gestiona sus propios bloqueos de riders
CREATE POLICY "rider_blocked_restaurant_all" ON public.rider_blocked_restaurants
  FOR ALL
  USING (restaurant_id = public.my_restaurant_id() OR public.is_super_admin());
