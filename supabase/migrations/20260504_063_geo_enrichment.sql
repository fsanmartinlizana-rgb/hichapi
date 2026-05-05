-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 063 — Geo Enrichment Agent + Claim flow hardening
-- Sprint 2026-05-04
--
-- Objetivos:
--   1. Permitir que un agente automático enriquezca la DB con restaurantes de
--      Google Places cuando el usuario busca en una zona sin cobertura.
--   2. Distinguir restaurantes manuales / agent_enriched / owner_claimed.
--   3. Endurecer las RLS de restaurant_claims (hoy permisivas) sin romper el
--      endpoint POST /api/restaurants/claim.
--
-- Filosofía: solo ADD COLUMN IF NOT EXISTS y CREATE TABLE IF NOT EXISTS — nunca
-- DROP de columnas/tablas. Las policies sí se reemplazan porque las actuales
-- son demasiado laxas (claims_service_read deja leer a cualquiera).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. restaurants: data_source + verified + google_* ──────────────────────────

-- `claimed` ya existe desde 025 con DEFAULT true (semánticamente erróneo: un
-- restaurant recién creado por defecto NO ha sido reclamado por su dueño).
-- Cambio el default sin tocar registros existentes — el agente insertará
-- explícitamente claimed=false para los restaurantes que descubre.
ALTER TABLE restaurants ALTER COLUMN claimed SET DEFAULT false;

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS verified    BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS data_source TEXT    DEFAULT 'manual';

-- CHECK constraint en data_source (solo 3 valores válidos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_data_source_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_data_source_check
      CHECK (data_source IN ('manual', 'agent_enriched', 'owner_claimed'));
  END IF;
END $$;

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_rating       NUMERIC(2,1);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_rating_count INT;
-- google_reviews: array JSON con como máximo 3 reviews. Estructura:
-- [{ author, rating, text, time }, ...]. La validación de tamaño se hace en
-- la app (insertar) — no agrego CHECK porque jsonb_array_length sobre un
-- valor null genera ruido y los inserts ya cap-ean a 3.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_reviews JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS config_chapi  JSONB DEFAULT '{}'::jsonb;

-- Índice por data_source para query "muéstrame todos los agent_enriched
-- pendientes de claim" en el panel admin.
CREATE INDEX IF NOT EXISTS idx_restaurants_data_source ON restaurants(data_source);

-- ── 2. restaurant_claims: añadir RUT y reviewed_by ─────────────────────────────
-- El endpoint actual usa owner_name/owner_email/owner_phone/message. Los dejo
-- intactos (no romper). Agrego columnas adicionales que el modal nuevo pedirá.
ALTER TABLE restaurant_claims ADD COLUMN IF NOT EXISTS claimant_rut TEXT;
ALTER TABLE restaurant_claims ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES auth.users(id);

-- Las RLS actuales son demasiado laxas:
--   "claims_public_insert"  → cualquier anónimo puede crear claims (OK para un
--                             form público, lo mantengo)
--   "claims_service_read"   → cualquier autenticado puede leer todos los claims
--                             (NO ok: expone email, teléfono, RUT de otros)
DROP POLICY IF EXISTS "claims_service_read" ON restaurant_claims;

-- Owner ve sus propios claims (matcheo por email del JWT).
CREATE POLICY "owner_own_claims" ON restaurant_claims
  FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

-- super_admin ve todos los claims.
CREATE POLICY "super_admin_all_claims" ON restaurant_claims
  FOR SELECT USING (public.is_super_admin());

-- super_admin puede UPDATE (aprobar/rechazar). El endpoint PATCH actual usa
-- service_role (bypassa RLS), así que esto es para queries directos del panel.
CREATE POLICY "super_admin_update_claims" ON restaurant_claims
  FOR UPDATE USING (public.is_super_admin())
                 WITH CHECK (public.is_super_admin());

-- ── 3. enrichment_jobs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone                  TEXT NOT NULL,
  query_original        TEXT,
  restaurants_found     INT DEFAULT 0,
  restaurants_inserted  INT DEFAULT 0,
  status                TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  error                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

-- Index por zona+created_at para el lookup "¿hubo job para esta zona en las
-- últimas 24h?" — patrón de dedupe.
CREATE INDEX IF NOT EXISTS idx_enrichment_zone_recent
  ON enrichment_jobs(zone, created_at DESC);

ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede leer la cola. La inserción y actualización viene del
-- endpoint /api/enrich-zone que usa service_role (bypassa RLS), así que NO
-- creo policy de INSERT/UPDATE públicas — eso es by design.
CREATE POLICY "super_admin_read_enrichment_jobs" ON enrichment_jobs
  FOR SELECT USING (public.is_super_admin());

-- ── 4. Auto-sync de restaurants.location desde lat/lng ─────────────────────────
-- Hasta ahora los seeds insertaban location explícitamente con ST_MakePoint.
-- El agente solo conoce lat/lng. Trigger conservador: solo rellena location si
-- viene NULL y hay lat/lng — no pisa rows ya correctos.
CREATE OR REPLACE FUNCTION public.restaurants_sync_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.location IS NULL AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_MakePoint(NEW.lng::float, NEW.lat::float)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurants_sync_location ON restaurants;
CREATE TRIGGER trg_restaurants_sync_location
  BEFORE INSERT OR UPDATE OF lat, lng, location ON restaurants
  FOR EACH ROW EXECUTE FUNCTION public.restaurants_sync_location();

-- Backfill: cualquier restaurant viejo que tenga lat/lng y location NULL.
UPDATE restaurants
   SET location = ST_MakePoint(lng::float, lat::float)::geography
 WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
