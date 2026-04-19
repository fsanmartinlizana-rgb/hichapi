-- ── Feature flags per-restaurant ────────────────────────────────────────────
-- Permite activar/desactivar features específicas sin tocar el plan. Usado
-- para:
--   • Rollouts graduales (beta testing de una feature en 5 restaurantes)
--   • Overrides manuales desde el panel super-admin ("este enterprise pidió
--     quitar geofencing pero darle API pública")
--   • A/B tests
--
-- Estructura: jsonb. Keys son strings, values son boolean.
-- Ejemplo: { "beta_dashboards": true, "ai_support_watcher": false }

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Índice GIN por si queremos filtrar por flag activo a escala
CREATE INDEX IF NOT EXISTS idx_restaurants_feature_flags
  ON restaurants USING gin (feature_flags);

COMMENT ON COLUMN restaurants.feature_flags IS
  'Feature flags manuales por restaurant. Overrides sobre lo que dicta el plan. JSON de tipo {flag_name: boolean}.';
