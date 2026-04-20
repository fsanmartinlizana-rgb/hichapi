-- ── Support tickets: priority + assignment + AI conversation ────────────────
-- Sprint 4 (2026-04-19): extiende support_tickets con campos para el panel
-- admin y el agente IA que asiste al super admin a resolver tickets.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS priority      TEXT NOT NULL DEFAULT 'normal'
                                           CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_at_open  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_support_priority
  ON support_tickets(priority, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_assigned
  ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

-- Policy adicional: super_admin puede leer y actualizar todos los tickets.
-- (la policy existente support_own_read solo dejaba al dueño leer el suyo)
DROP POLICY IF EXISTS "support_super_admin_all" ON support_tickets;
CREATE POLICY "support_super_admin_all" ON support_tickets
  FOR ALL
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

COMMENT ON COLUMN support_tickets.priority IS
  'Prioridad derivada del plan (enterprise=urgent, pro=high, starter=normal, free=low) + ajustes manuales.';
COMMENT ON COLUMN support_tickets.conversation IS
  'Historial del agente IA + super admin resolviendo el ticket. JSONB array de {role, text, ts}.';
COMMENT ON COLUMN support_tickets.plan_at_open IS
  'Snapshot del plan del restaurant al momento de abrir el ticket (para SLA).';
