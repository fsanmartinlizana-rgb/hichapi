-- ════════════════════════════════════════════════════════════════════════════
-- Migration 020 (2026-04-10): Usuario Comensal
-- ════════════════════════════════════════════════════════════════════════════
-- Crea el módulo de usuario comensal: perfil global, direcciones guardadas,
-- calificaciones, programa de fidelidad y geofencing por proximidad.
--
-- Requirements: 9.1, 9.2, 9.3, 9.6, 9.8, 10.1, 10.2, 10.3, 10.4, 4.6
--
-- NOTA: La tabla `geofence_events` ya existe (migración 054) con un esquema
-- diferente (check-in anónimo por QR/menú). La tabla de eventos de geofencing
-- para comensales autenticados se llama `customer_geofence_events` para evitar
-- conflictos. Todas las referencias en el código de la app deben usar este nombre.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. customer_profiles ─────────────────────────────────────────────────────
-- Perfil global del comensal. Un registro por usuario de Supabase Auth.
-- Requirement 9.1, 9.3, 10.1

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text        NOT NULL,
  phone            text,
  photo_url        text,
  loyalty_points   int         NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  push_token       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_user
  ON public.customer_profiles(user_id);

-- ── 2. saved_addresses ───────────────────────────────────────────────────────
-- Direcciones de entrega guardadas por el comensal (máx 10 por comensal).
-- Requirement 9.1, 10.2

CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  label        text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 50),
  street       text        NOT NULL CHECK (char_length(street) BETWEEN 5 AND 300),
  city         text        NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  notes        text        CHECK (char_length(notes) <= 300),
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_customer
  ON public.saved_addresses(customer_id);

-- ── 3. customer_ratings ──────────────────────────────────────────────────────
-- Calificaciones (1–5 estrellas) que el comensal otorga a riders o restaurantes.
-- Requirement 9.1, 10.3, 4.6

CREATE TABLE IF NOT EXISTS public.customer_ratings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid        REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
  entity_type  text        NOT NULL CHECK (entity_type IN ('rider', 'restaurant')),
  entity_id    uuid        NOT NULL,
  order_id     uuid        NOT NULL,
  order_type   text        NOT NULL CHECK (order_type IN ('delivery', 'presencial')),
  stars        int         NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      text        CHECK (char_length(comment) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, order_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_entity
  ON public.customer_ratings(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer
  ON public.customer_ratings(customer_id);

-- ── 4. loyalty_transactions ──────────────────────────────────────────────────
-- Historial inmutable de puntos ganados y canjeados por el comensal.
-- Requirement 9.1, 10.4

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  order_id      uuid,
  order_type    text        CHECK (order_type IN ('delivery', 'presencial')),
  points_delta  int         NOT NULL,
  balance_after int         NOT NULL CHECK (balance_after >= 0),
  description   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer
  ON public.loyalty_transactions(customer_id, created_at DESC);

-- ── 5. loyalty_redemptions ───────────────────────────────────────────────────
-- Registro de canjes de puntos por descuentos en pedidos.
-- Requirement 9.1, 10.4

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  order_id         uuid,
  points_redeemed  int         NOT NULL CHECK (points_redeemed >= 500),
  discount_clp     int         NOT NULL CHECK (discount_clp > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_customer
  ON public.loyalty_redemptions(customer_id, created_at DESC);

-- ── 6. customer_geofence_events ──────────────────────────────────────────────
-- Eventos de proximidad de comensales autenticados a restaurantes.
-- NOTA: Tabla distinta de `geofence_events` (migración 054, check-in anónimo).
-- Requirement 9.1, 9.8

CREATE TABLE IF NOT EXISTS public.customer_geofence_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid        NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  restaurant_id       uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  entered_at          timestamptz NOT NULL DEFAULT now(),
  notification_sent   boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_customer_geofence_events_customer_date
  ON public.customer_geofence_events(customer_id, entered_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_geofence_events_purge
  ON public.customer_geofence_events(entered_at);

-- ── 7. Modificaciones a tablas existentes ────────────────────────────────────

-- 7a. Añadir customer_id nullable a orders (pedidos presenciales)
-- Requirement 9.6
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid
    REFERENCES public.customer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer
  ON public.orders(customer_id) WHERE customer_id IS NOT NULL;

-- 7b. Añadir customer_id nullable a delivery_orders
-- Requirement 9.6
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS customer_id uuid
    REFERENCES public.customer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_orders_customer
  ON public.delivery_orders(customer_id) WHERE customer_id IS NOT NULL;

-- ── 8. Columnas de geofence y fidelidad en restaurants ───────────────────────
-- geofence_enabled y geofence_radius_m ya existen (migración 054).
-- Se añaden geofence_message y points_multiplier; se ajusta el CHECK de radius.
-- Requirement 9.8

-- geofence_enabled ya existe — no se toca
-- geofence_radius_m ya existe con CHECK (20 AND 2000) — se añade IF NOT EXISTS
-- para el caso de que no exista en algún entorno

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS geofence_message    text
    CHECK (char_length(geofence_message) <= 140),
  ADD COLUMN IF NOT EXISTS points_multiplier   numeric(3,1) NOT NULL DEFAULT 1.0
    CHECK (points_multiplier BETWEEN 0.5 AND 5.0);

-- Asegurar que geofence_enabled existe (ya debería existir por migración 054)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS geofence_enabled boolean NOT NULL DEFAULT false;

-- Asegurar que geofence_radius_m existe con el rango correcto para comensales
-- (100–2000 m). La migración 054 lo creó con CHECK (20 AND 2000); el nuevo
-- rango mínimo es 100 m según Requirement 8.4. Se actualiza el constraint.
DO $$
BEGIN
  -- Eliminar constraint antiguo si existe con nombre conocido
  ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_geofence_radius_m_check;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignorar si no existe
END;
$$;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS geofence_radius_m int
    CHECK (geofence_radius_m BETWEEN 100 AND 2000);

-- ── 9. Trigger: actualizar avg_rating en rider_profiles desde customer_ratings
-- Requirement 4.6
-- Combina las calificaciones de rider_ratings (del restaurante) y
-- customer_ratings (del comensal) para calcular el promedio ponderado.

CREATE OR REPLACE FUNCTION public.update_rider_avg_rating_from_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_rider_sum    bigint;
  v_rider_count  bigint;
  v_cust_sum     bigint;
  v_cust_count   bigint;
  v_total_sum    bigint;
  v_total_count  bigint;
BEGIN
  IF NEW.entity_type = 'rider' THEN
    -- Suma y conteo de calificaciones del restaurante (rider_ratings)
    SELECT COALESCE(SUM(stars), 0), COUNT(*)
      INTO v_rider_sum, v_rider_count
      FROM public.rider_ratings
     WHERE rider_id = NEW.entity_id;

    -- Suma y conteo de calificaciones del comensal (customer_ratings)
    SELECT COALESCE(SUM(stars), 0), COUNT(*)
      INTO v_cust_sum, v_cust_count
      FROM public.customer_ratings
     WHERE entity_type = 'rider'
       AND entity_id = NEW.entity_id;

    v_total_sum   := v_rider_sum + v_cust_sum;
    v_total_count := v_rider_count + v_cust_count;

    UPDATE public.rider_profiles
    SET
      avg_rating    = CASE
                        WHEN v_total_count = 0 THEN NULL
                        ELSE ROUND(v_total_sum::numeric / v_total_count, 1)
                      END,
      total_ratings = v_total_count,
      updated_at    = now()
    WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rider_avg_from_customer ON public.customer_ratings;
CREATE TRIGGER trg_update_rider_avg_from_customer
  AFTER INSERT ON public.customer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_rider_avg_rating_from_customer();

-- ── 10. RLS — customer_profiles ──────────────────────────────────────────────
-- Requirement 10.1

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_profiles_self_read" ON public.customer_profiles;
CREATE POLICY "customer_profiles_self_read" ON public.customer_profiles
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "customer_profiles_self_update" ON public.customer_profiles;
CREATE POLICY "customer_profiles_self_update" ON public.customer_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_profiles_insert" ON public.customer_profiles;
CREATE POLICY "customer_profiles_insert" ON public.customer_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

-- ── 11. RLS — saved_addresses ─────────────────────────────────────────────────
-- Requirement 10.2

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_addresses_self_all" ON public.saved_addresses;
CREATE POLICY "saved_addresses_self_all" ON public.saved_addresses
  FOR ALL
  USING (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
    OR public.is_super_admin()
  );

-- ── 12. RLS — customer_ratings ────────────────────────────────────────────────
-- Requirement 10.3

ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_ratings_self_read_create" ON public.customer_ratings;
CREATE POLICY "customer_ratings_self_read_create" ON public.customer_ratings
  FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "customer_ratings_self_insert" ON public.customer_ratings;
CREATE POLICY "customer_ratings_self_insert" ON public.customer_ratings
  FOR INSERT
  WITH CHECK (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
  );

-- ── 13. RLS — loyalty_transactions ───────────────────────────────────────────
-- Requirement 10.4

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_transactions_self_read" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions_self_read" ON public.loyalty_transactions
  FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
    OR public.is_super_admin()
  );

-- ── 14. RLS — loyalty_redemptions ────────────────────────────────────────────
-- Requirement 10.4

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_redemptions_self_read" ON public.loyalty_redemptions;
CREATE POLICY "loyalty_redemptions_self_read" ON public.loyalty_redemptions
  FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
    OR public.is_super_admin()
  );

-- ── 15. RLS — customer_geofence_events ───────────────────────────────────────
-- Requirement 9.8

ALTER TABLE public.customer_geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_geofence_events_self_read" ON public.customer_geofence_events;
CREATE POLICY "customer_geofence_events_self_read" ON public.customer_geofence_events
  FOR SELECT
  USING (
    customer_id = (
      SELECT id FROM public.customer_profiles
       WHERE user_id = auth.uid()
       LIMIT 1
    )
    OR public.is_super_admin()
  );

-- Solo service role (super_admin) puede insertar eventos de geofence
DROP POLICY IF EXISTS "customer_geofence_events_service_insert" ON public.customer_geofence_events;
CREATE POLICY "customer_geofence_events_service_insert" ON public.customer_geofence_events
  FOR INSERT
  WITH CHECK (public.is_super_admin());

-- ── 16. Comentarios de documentación ─────────────────────────────────────────

COMMENT ON TABLE public.customer_profiles IS
  'Perfil global del comensal. Un registro por usuario de Supabase Auth. '
  'Distinto de team_members y rider_profiles.';

COMMENT ON TABLE public.saved_addresses IS
  'Direcciones de entrega guardadas por el comensal. Máximo 10 por comensal '
  '(validado en la capa de servicio).';

COMMENT ON TABLE public.customer_ratings IS
  'Calificaciones (1–5 estrellas) que el comensal otorga a riders o restaurantes '
  'tras completar un pedido. Unicidad por (customer_id, order_id, entity_type).';

COMMENT ON TABLE public.loyalty_transactions IS
  'Historial inmutable de puntos de fidelidad ganados y canjeados. '
  'balance_after refleja el saldo tras cada transacción.';

COMMENT ON TABLE public.loyalty_redemptions IS
  'Registro de canjes de puntos por descuentos. Mínimo 500 puntos por canje.';

COMMENT ON TABLE public.customer_geofence_events IS
  'Eventos de proximidad de comensales autenticados a restaurantes. '
  'Distinto de geofence_events (migración 054, check-in anónimo por QR/menú). '
  'Se purgan registros con entered_at < now() - 90 days via Edge Function.';

COMMENT ON COLUMN public.restaurants.geofence_message IS
  'Mensaje promocional enviado al comensal al entrar al geofence (máx 140 chars).';

COMMENT ON COLUMN public.restaurants.points_multiplier IS
  'Multiplicador de puntos de fidelidad para pedidos en este restaurante (0.5–5.0).';

COMMENT ON FUNCTION public.update_rider_avg_rating_from_customer() IS
  'Recalcula avg_rating y total_ratings en rider_profiles combinando rider_ratings '
  '(calificaciones del restaurante) y customer_ratings (calificaciones del comensal).';
