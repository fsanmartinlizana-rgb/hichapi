-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 9: Cash session expenses (gastos)
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   • cash_session_expenses — gastos registered during an open cash session
--     (proveedores, propinas pagadas en efectivo, compras menores, etc.)
--   • They subtract from expected cash at close time.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cash_session_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL CHECK (amount > 0),
  category       TEXT NOT NULL DEFAULT 'otros'
                   CHECK (category IN ('proveedor','propina','insumos','servicios','otros')),
  description    TEXT NOT NULL,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_expenses_session
  ON cash_session_expenses(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_expenses_restaurant_date
  ON cash_session_expenses(restaurant_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE cash_session_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_expenses_read  ON cash_session_expenses;
DROP POLICY IF EXISTS cash_expenses_write ON cash_session_expenses;

CREATE POLICY cash_expenses_read ON cash_session_expenses
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM team_members
      WHERE user_id = auth.uid()
        AND role IN ('owner','admin','supervisor','cajero')
    )
  );

CREATE POLICY cash_expenses_write ON cash_session_expenses
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM team_members
      WHERE user_id = auth.uid()
        AND role IN ('owner','admin','supervisor','cajero')
    )
  );

-- ── Optional: expose total_expenses on cash_register_sessions snapshot ──────
ALTER TABLE cash_register_sessions
  ADD COLUMN IF NOT EXISTS total_expenses INTEGER NOT NULL DEFAULT 0;

COMMENT ON TABLE cash_session_expenses IS
  'Cash outflows (gastos) registered during an open cash session. Subtract from expected cash at close.';
