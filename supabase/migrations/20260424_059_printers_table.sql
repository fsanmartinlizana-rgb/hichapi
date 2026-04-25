-- ════════════════════════════════════════════════════════════════════════════
--  Migration 059: Printers table
--
--  Tabla simple de impresoras por restaurante. Cada impresora tiene un nombre
--  que se pasa como campo `impresora` al notifier (https://api.notifier.realdev.cl).
--  El notifier enruta por nombre a la impresora física correspondiente.
--
--  No requiere agente local ni IP — solo el nombre que el notifier conoce.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS printers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,           -- nombre que el notifier usa para enrutar (ej: COCINA1, BARRA, CAJA)
  description   TEXT,                    -- descripción legible (ej: "Impresora cocina planta baja")
  kind          TEXT NOT NULL DEFAULT 'cocina'
    CHECK (kind IN ('cocina', 'barra', 'caja', 'otro')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)           -- nombre único por restaurante
);

CREATE INDEX IF NOT EXISTS idx_printers_restaurant ON printers(restaurant_id, active);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_printers" ON printers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = printers.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_manage_printers" ON printers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.restaurant_id = printers.restaurant_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin', 'super_admin')
    )
  );

COMMENT ON TABLE printers IS
  'Impresoras registradas por restaurante. El campo name se pasa como impresora al notifier.';
