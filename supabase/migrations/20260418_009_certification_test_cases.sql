-- ════════════════════════════════════════════════════════════════════════════
--  DTE Certification — Test Cases Table
--
--  Stores individual parsed test cases from SET_DE_PRUEBAS files.
--  Each case represents one DTE that must be generated and submitted.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS test_cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_set_id       UUID NOT NULL REFERENCES test_sets(id) ON DELETE CASCADE,
  
  -- Case identification
  case_number       TEXT NOT NULL,
  document_type     INTEGER NOT NULL,
  
  -- Parsed data (stored as JSONB for flexibility)
  items             JSONB NOT NULL,
  receptor_data     JSONB,
  reference_data    JSONB,
  global_discount   JSONB,
  export_data       JSONB,
  liquidacion_data  JSONB,
  
  -- Audit trail
  raw_text          TEXT NOT NULL,
  
  -- Link to generated emission
  emission_id       UUID REFERENCES dte_emissions(id) ON DELETE SET NULL,
  
  -- Status workflow
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'generated', 'signed', 'sent', 'accepted', 'rejected', 'error')),
  
  error_message     TEXT,
  
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one case number per test set
  CONSTRAINT unique_case_number UNIQUE (test_set_id, case_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS test_cases_set_idx 
  ON test_cases(test_set_id);

CREATE INDEX IF NOT EXISTS test_cases_status_idx 
  ON test_cases(test_set_id, status);

CREATE INDEX IF NOT EXISTS test_cases_emission_idx 
  ON test_cases(emission_id) WHERE emission_id IS NOT NULL;

-- RLS policies
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_test_cases" ON test_cases;
DROP POLICY IF EXISTS "owner_admin_write_test_cases" ON test_cases;

CREATE POLICY "staff_read_test_cases" ON test_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_sets ts
      JOIN team_members tm ON tm.restaurant_id = ts.restaurant_id
      WHERE ts.id = test_cases.test_set_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
    )
  );

CREATE POLICY "owner_admin_write_test_cases" ON test_cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM test_sets ts
      JOIN team_members tm ON tm.restaurant_id = ts.restaurant_id
      WHERE ts.id = test_cases.test_set_id
        AND tm.user_id = auth.uid()
        AND tm.active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_test_cases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS test_cases_updated_at_trigger ON test_cases;
CREATE TRIGGER test_cases_updated_at_trigger
  BEFORE UPDATE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION update_test_cases_updated_at();

COMMENT ON TABLE test_cases IS
  'Individual test cases parsed from SII SET_DE_PRUEBAS files. Each case contains structured data for generating one DTE document.';
