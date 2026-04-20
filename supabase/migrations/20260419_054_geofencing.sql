-- ── Geofencing ──────────────────────────────────────────────────────────────
-- Sprint 6 (2026-04-19). Feature enterprise.
--
-- Permite detectar si un cliente que escanea un QR o abre el menú público
-- está físicamente dentro del radio del local. Útil para check-in automático
-- y validación de reseñas.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS geofence_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geofence_lng        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geofence_radius_m   INTEGER DEFAULT 150
                                                CHECK (geofence_radius_m BETWEEN 20 AND 2000),
  ADD COLUMN IF NOT EXISTS geofence_enabled    BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS geofence_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  accuracy_m      NUMERIC,
  within_radius   BOOLEAN NOT NULL,
  distance_m      NUMERIC,
  trigger_source  TEXT CHECK (trigger_source IN ('menu_open','qr_scan','check_in','other')),
  user_agent      TEXT,
  session_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_rest_time
  ON geofence_events(restaurant_id, created_at DESC);

ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- Solo admins del restaurant pueden leer sus eventos. El INSERT se hace
-- via service role desde el endpoint público; no necesita policy INSERT aquí.
DROP POLICY IF EXISTS geofence_events_admin_r ON geofence_events;
CREATE POLICY geofence_events_admin_r ON geofence_events
  FOR SELECT
  USING (public.is_admin_for(restaurant_id));

COMMENT ON COLUMN restaurants.geofence_lat IS 'Latitud del centro de geofence. NULL = no configurado.';
COMMENT ON COLUMN restaurants.geofence_radius_m IS 'Radio en metros (20-2000) dentro del cual se considera "dentro del local".';
COMMENT ON TABLE geofence_events IS 'Eventos de check-in por ubicación. Audit de quién (session/UA) estuvo dentro del geofence.';
