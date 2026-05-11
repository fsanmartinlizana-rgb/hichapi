-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 066 — Tagging estructurado del motivo por el que una búsqueda
-- no devolvió resultados.
--
-- Antes: el dashboard solo veía `no_results_in_zone=true/false`, sin distinguir
-- entre "zona vacía" vs "hay restaurants pero no de cuisine pedida" vs
-- "ninguno tiene menú para dietary X" vs "ninguno entra en presupuesto".
-- Eso impedía priorizar qué arreglar (¿enriquecer más zonas? ¿pedirle a owners
-- que taguen sin gluten? ¿revisar pricing?).
--
-- Ahora: failure_reason explícito con 4 valores canónicos.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE search_events
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_events_failure_reason_check'
  ) THEN
    ALTER TABLE search_events
      ADD CONSTRAINT search_events_failure_reason_check
      CHECK (failure_reason IS NULL OR failure_reason IN (
        'no_zone_coverage',     -- zona sin restaurants en DB todavía
        'no_cuisine_match',     -- hay restaurants en zona pero no de cuisine pedida
        'no_dietary_match',     -- hay cuisine match pero ningún menu satisface dietary
        'no_budget_match',      -- hay cuisine match pero ningún menu en presupuesto
        'enrichment_skipped'    -- agente no disparó (budget/dedup/sin sentido)
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_search_events_failure
  ON search_events(failure_reason, created_at DESC)
  WHERE failure_reason IS NOT NULL;

COMMENT ON COLUMN search_events.failure_reason IS
  'Razón canónica del fail: no_zone_coverage / no_cuisine_match / no_dietary_match / no_budget_match / enrichment_skipped. NULL = búsqueda exitosa.';
