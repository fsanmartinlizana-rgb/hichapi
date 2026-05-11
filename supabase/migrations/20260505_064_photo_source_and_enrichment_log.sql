-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 064 — Photo source tracking + enrichment log
-- Sprint 2026-05-05
--
-- Objetivos:
--   1. Distinguir el origen de la foto de un restaurant (owner vs Google vs
--      placeholder), para que el agente NUNCA sobrescriba una foto subida por
--      el dueño.
--   2. Auditoría completa de gasto de Google Places + cap por zona+cuisine.
--
-- Filosofía: solo ADD COLUMN IF NOT EXISTS y CREATE TABLE IF NOT EXISTS.
-- Sin DROP. Sin ALTER destructivo.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. restaurants: trazabilidad del origen de la foto ────────────────────────

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS photo_source            TEXT,
  ADD COLUMN IF NOT EXISTS photo_fetched_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_fetch_attempted   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_photo_attribution JSONB;

-- CHECK constraint con los 3 valores permitidos (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_photo_source_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_photo_source_check
      CHECK (photo_source IS NULL OR photo_source IN ('google_places', 'owner_upload', 'placeholder'));
  END IF;
END $$;

-- Backfill: restaurants existentes con photo_url poblado son del owner
-- (los manuales fueron seedeados u owners reales; agent_enriched todavía
-- tiene photo_url=NULL). Esto blinda los 30 que ya tienen foto.
UPDATE restaurants
   SET photo_source = 'owner_upload'
 WHERE photo_url IS NOT NULL
   AND photo_source IS NULL;

-- Índice parcial — el agente filtra por estos para decidir si vale intentar.
CREATE INDEX IF NOT EXISTS idx_restaurants_photo_fetch_pending
  ON restaurants(id)
  WHERE photo_fetch_attempted = false AND photo_url IS NULL;

-- ── 2. enrichment_log — auditoría + dedupe + budget ───────────────────────────
--
-- Una row por cada llamada exitosa a Google Places. Sirve para:
--   - Dedupe 30 días por zone+cuisine (evita llamadas duplicadas)
--   - Cálculo del gasto mensual (SUM(cost_usd) en el mes actual)
--   - Auditoría de costos
--
-- zone_key = slug del texto de zona (concon, maipu, santiago-centro) o
-- `geo:LAT_LNG` si la búsqueda fue por coordenadas.

CREATE TABLE IF NOT EXISTS enrichment_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key          TEXT NOT NULL,
  cuisine           TEXT,
  last_enriched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  results_count     INT NOT NULL DEFAULT 0,
  cost_usd          NUMERIC(10, 4) NOT NULL DEFAULT 0,
  -- Desglose opcional del costo (útil para entender la mezcla del gasto)
  text_search_count INT NOT NULL DEFAULT 0,
  photo_count       INT NOT NULL DEFAULT 0,
  enrichment_job_id UUID REFERENCES enrichment_jobs(id) ON DELETE SET NULL
);

-- Index principal del dedupe (zone_key + cuisine + recencia)
CREATE INDEX IF NOT EXISTS idx_enrichment_log_dedupe
  ON enrichment_log(zone_key, cuisine, last_enriched_at DESC);

-- Index para query del budget mensual: SUM por mes
CREATE INDEX IF NOT EXISTS idx_enrichment_log_month
  ON enrichment_log(last_enriched_at DESC);

ALTER TABLE enrichment_log ENABLE ROW LEVEL SECURITY;

-- Solo super_admin lee. INSERT viene del endpoint con service_role (bypassa RLS).
CREATE POLICY "super_admin_read_enrichment_log" ON enrichment_log
  FOR SELECT USING (public.is_super_admin());
