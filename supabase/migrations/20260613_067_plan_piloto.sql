-- ─────────────────────────────────────────────────────────────────────────────
-- 067: Plan Piloto en restaurants.plan
--
-- Agrega 'piloto' al CHECK constraint para permitir registros con el nuevo
-- Plan Piloto ($0, comisión 2%, acceso nivel Pro vía PLAN_LEVEL_ALIAS).
-- Bug detectado 2026-06-13: el insert con plan='piloto' fallaba con 23514
-- (check_violation) y la UI mostraba "No pudimos crear tu restaurante."
--
-- También agrega un comentario para documentar los valores válidos.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check
  CHECK (plan IN ('free', 'piloto', 'discovery', 'at_table', 'starter', 'pro', 'enterprise'));

COMMENT ON COLUMN public.restaurants.plan IS
  'Plan activo del restaurante. free/piloto/starter/pro/enterprise son los planes vivos hoy. discovery/at_table son legados.';
