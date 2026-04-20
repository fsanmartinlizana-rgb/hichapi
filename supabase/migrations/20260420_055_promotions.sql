-- ── Promociones dinámicas ───────────────────────────────────────────────
-- Cada restaurant puede crear promociones con ventana horaria, descuento y
-- canales (mesa, lista de espera, Discovery). Activas/inactivas por fecha
-- de inicio/fin. Opcionalmente aplican a platos específicos.
--
-- Sprint 2026-04-20.

CREATE TABLE IF NOT EXISTS promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description     TEXT CHECK (description IS NULL OR length(description) <= 400),
  kind            TEXT NOT NULL DEFAULT 'discount_pct'
                    CHECK (kind IN ('discount_pct','discount_amount','2x1','combo','happy_hour')),
  -- Descuento porcentual (0-100) o monto CLP fijo según "kind".
  value           INTEGER,
  -- Ventana horaria recurrente (ej "15:00-17:00"). NULL = todo el día.
  time_start      TIME,
  time_end        TIME,
  -- Días de la semana en los que aplica (0=Dom..6=Sab). NULL = todos.
  days_of_week    INTEGER[],
  -- Ventana de vigencia calendaria.
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,
  -- Canales de difusión.
  channel_mesa    BOOLEAN NOT NULL DEFAULT true,
  channel_espera  BOOLEAN NOT NULL DEFAULT true,
  channel_chapi   BOOLEAN NOT NULL DEFAULT true,
  -- Array de menu_item_ids a los que aplica. NULL/empty = toda la carta.
  menu_item_ids   UUID[],
  active          BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_rest_active
  ON promotions(restaurant_id, active, valid_from);
CREATE INDEX IF NOT EXISTS idx_promotions_rest_created
  ON promotions(restaurant_id, created_at DESC);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- RLS: admin/owner/supervisor del restaurant pueden leer y escribir.
DROP POLICY IF EXISTS promotions_admin_rw ON promotions;
CREATE POLICY promotions_admin_rw ON promotions
  FOR ALL
  USING  (public.is_admin_for(restaurant_id))
  WITH CHECK (public.is_admin_for(restaurant_id));

-- Read-only público: cualquier team member activo puede listar (para que el
-- panel garzón/comandas pueda ver qué está activo).
DROP POLICY IF EXISTS promotions_team_read ON promotions;
CREATE POLICY promotions_team_read ON promotions
  FOR SELECT
  USING (public.is_team_member(restaurant_id));

COMMENT ON TABLE promotions IS
  'Promociones dinámicas por restaurant (happy hour, combos, descuentos). Gestionadas desde /promociones.';
