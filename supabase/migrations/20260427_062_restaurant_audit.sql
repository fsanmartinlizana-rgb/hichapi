-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 062: restaurant_audit — tracking de cambios sensibles de restaurants
-- Sprint 4.1 (2026-04-27)
--
-- Tabla append-only que registra cambios de campos sensibles de `restaurants`
-- (principalmente `plan` para detectar upgrades/downgrades). El founder usa esto
-- para ver:
--   • Qué restaurantes upgradearon esta semana → señal de revenue
--   • Quién downgrade-ó → señal temprana de churn
--   • Tendencia de upgrades por semana (gráfico)
--
-- Migration idempotente. Se puede correr múltiples veces sin error.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Tabla
CREATE TABLE IF NOT EXISTS restaurant_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  field         TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE restaurant_audit IS 'Append-only log de cambios de campos sensibles de restaurants (plan, active, etc).';
COMMENT ON COLUMN restaurant_audit.field IS 'Nombre del campo que cambió. Ej: "plan", "active".';

-- 2. Indices: queries típicas son "todos los cambios de plan últimas N semanas"
--    y "historial de un restaurant específico"
CREATE INDEX IF NOT EXISTS idx_restaurant_audit_field_changed
  ON restaurant_audit (field, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_audit_restaurant
  ON restaurant_audit (restaurant_id, changed_at DESC);

-- 3. Trigger function: registra cambio de plan
CREATE OR REPLACE FUNCTION log_restaurant_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    INSERT INTO restaurant_audit (restaurant_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'plan', OLD.plan, NEW.plan, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger AFTER UPDATE — solo si el plan cambia
DROP TRIGGER IF EXISTS restaurants_audit_plan ON restaurants;
CREATE TRIGGER restaurants_audit_plan
  AFTER UPDATE OF plan ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION log_restaurant_plan_change();

-- 5. RLS: solo super_admin puede leer (mismo patrón que support_tickets en 052)
ALTER TABLE restaurant_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurant_audit_super_admin_read ON restaurant_audit;
CREATE POLICY restaurant_audit_super_admin_read
  ON restaurant_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND team_members.role = 'super_admin'
        AND team_members.active = true
    )
  );

-- No policies de INSERT/UPDATE/DELETE: solo el trigger SECURITY DEFINER
-- escribe en esta tabla. Cliente normal no debería poder modificarla.
